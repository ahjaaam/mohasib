-- Keep account access, subscription history, and bulk lifecycle transitions
-- consistent by applying each logical admin action in one database transaction.

CREATE OR REPLACE FUNCTION public.admin_set_company_access(
  p_company_id uuid,
  p_status text,
  p_end_date date DEFAULT NULL,
  p_billing_period text DEFAULT 'monthly',
  p_amount_mad numeric DEFAULT 0,
  p_payment_method text DEFAULT NULL,
  p_payment_reference text DEFAULT NULL,
  p_created_by_email text DEFAULT NULL,
  p_restart boolean DEFAULT false
)
RETURNS TABLE(status text, ends_at date, subscription_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company public.companies%ROWTYPE;
  v_subscription_id uuid;
BEGIN
  IF p_status NOT IN ('free', 'trial', 'active', 'grace', 'expired') THEN
    RAISE EXCEPTION 'invalid subscription status';
  END IF;
  IF p_status = 'active' AND (p_end_date IS NULL OR p_end_date < current_date) THEN
    RAISE EXCEPTION 'active access requires a current or future end date';
  END IF;
  IF p_amount_mad IS NULL OR p_amount_mad < 0 THEN
    RAISE EXCEPTION 'amount must be positive or zero';
  END IF;

  SELECT * INTO v_company
  FROM public.companies
  WHERE id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'company not found';
  END IF;

  UPDATE public.companies
  SET
    plan = CASE WHEN p_status = 'free' THEN 'free' WHEN p_status = 'trial' THEN 'trial' ELSE 'custom' END,
    subscription_status = p_status,
    subscription_ends_at = CASE WHEN p_status = 'free' THEN NULL WHEN p_status = 'trial' THEN v_company.subscription_ends_at ELSE p_end_date END,
    trial_ends_at = CASE
      WHEN p_status = 'free' THEN NULL
      WHEN p_status = 'trial' AND p_end_date IS NOT NULL THEN p_end_date::timestamp + interval '1 day' - interval '1 millisecond'
      ELSE v_company.trial_ends_at
    END,
    scheduled_plan = NULL,
    scheduled_plan_date = NULL
  WHERE id = p_company_id;

  IF p_status = 'active' THEN
    UPDATE public.subscriptions AS subscription
    SET status = 'cancelled'
    WHERE subscription.company_id = p_company_id AND subscription.status = 'active';

    INSERT INTO public.subscriptions (
      company_id, plan, previous_plan, change_type, billing_period,
      amount_mad, payment_method, payment_reference, starts_at, ends_at,
      status, created_by_email
    ) VALUES (
      p_company_id,
      'custom',
      v_company.plan,
      CASE WHEN v_company.subscription_status = 'active' THEN 'renewal' WHEN p_restart THEN 'restart' ELSE 'activation' END,
      CASE WHEN p_billing_period = 'annual' THEN 'annual' ELSE 'monthly' END,
      p_amount_mad,
      NULLIF(p_payment_method, ''),
      NULLIF(p_payment_reference, ''),
      current_date,
      p_end_date,
      'active',
      p_created_by_email
    ) RETURNING id INTO v_subscription_id;
  END IF;

  RETURN QUERY SELECT p_status, p_end_date, v_subscription_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_company_access(uuid, text, date, text, numeric, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_company_access(uuid, text, date, text, numeric, text, text, text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_bulk_transition_companies(
  p_company_ids uuid[],
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_action NOT IN ('suspend', 'reactivate', 'archive', 'restore') THEN
    RAISE EXCEPTION 'invalid company transition';
  END IF;

  RETURN QUERY
  UPDATE public.companies AS company
  SET
    is_suspended = CASE
      WHEN p_action = 'suspend' THEN true
      WHEN p_action IN ('reactivate', 'restore') THEN false
      ELSE company.is_suspended
    END,
    suspended_reason = CASE
      WHEN p_action = 'suspend' THEN COALESCE(NULLIF(p_reason, ''), 'Action groupée administrateur')
      WHEN p_action IN ('reactivate', 'restore') THEN NULL
      ELSE company.suspended_reason
    END,
    lifecycle_stage = CASE WHEN p_action = 'archive' THEN 'archived' WHEN p_action = 'restore' THEN 'active' ELSE company.lifecycle_stage END,
    archived_at = CASE WHEN p_action = 'archive' THEN now() WHEN p_action = 'restore' THEN NULL ELSE company.archived_at END,
    plan = CASE WHEN p_action = 'restore' AND company.subscription_status = 'expired' THEN 'free' ELSE company.plan END,
    subscription_status = CASE WHEN p_action = 'restore' AND company.subscription_status = 'expired' THEN 'free' ELSE company.subscription_status END,
    subscription_ends_at = CASE WHEN p_action = 'restore' AND company.subscription_status = 'expired' THEN NULL ELSE company.subscription_ends_at END,
    scheduled_plan = CASE WHEN p_action = 'restore' AND company.subscription_status = 'expired' THEN NULL ELSE company.scheduled_plan END,
    scheduled_plan_date = CASE WHEN p_action = 'restore' AND company.subscription_status = 'expired' THEN NULL ELSE company.scheduled_plan_date END
  WHERE company.id = ANY(p_company_ids)
  RETURNING company.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_transition_companies(uuid[], text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bulk_transition_companies(uuid[], text, text) TO service_role;
