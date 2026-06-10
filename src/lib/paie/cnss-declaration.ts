const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function roundHalf(n: number) {
  return Math.round(n * 2) / 2;
}

function workingDaysInMonth(mois: number, annee: number) {
  const last = new Date(annee, mois, 0).getDate();
  let days = 0;
  for (let d = 1; d <= last; d += 1) {
    if (new Date(annee, mois - 1, d).getDay() !== 0) days += 1;
  }
  return days;
}

function normalizeStatus(status: unknown) {
  return String(status ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function buildCnssDeclaration({ supabase, userId, mois, annee, dossierId }: {
  supabase: any;
  userId: string;
  mois: number;
  annee: number;
  dossierId?: string | null;
}) {
  const periodLabel = `${MONTHS[mois - 1]} ${annee}`;
  const { data: company } = await supabase.from("companies").select("*").eq("user_id", userId).single();

  let q = supabase
    .from("bulletins_paie")
    .select("*")
    .eq("mois", mois)
    .eq("annee", annee);
  if (dossierId) q = q.eq("dossier_id", dossierId);
  else q = q.is("dossier_id", null);
  const { data: bulletinRows } = await q;
  const bulletins = (bulletinRows ?? []).filter((b: any) => {
    const status = normalizeStatus(b.statut);
    return status.includes("valid") || status.includes("paye") || status.includes("pay");
  });

  const employeeIds = Array.from(new Set([
    ...bulletins.map((b: any) => b.employee_id),
  ]));

  let employeeRows: any[] = [];
  if (employeeIds.length) {
    let empQ = supabase
      .from("employees")
      .select("id, nom, prenom, matricule, numero_cnss, cnss_number, statut")
      .in("id", employeeIds);
    if (dossierId) empQ = empQ.eq("dossier_id", dossierId);
    else empQ = empQ.is("dossier_id", null);
    const { data } = await empQ;
    employeeRows = data ?? [];
  }

  let activeEmployeesQ = supabase
    .from("employees")
    .select("id, nom, prenom, matricule, numero_cnss, cnss_number, statut")
    .eq("user_id", userId)
    .eq("statut", "actif");
  if (dossierId) activeEmployeesQ = activeEmployeesQ.eq("dossier_id", dossierId);
  else activeEmployeesQ = activeEmployeesQ.is("dossier_id", null);
  const { data: activeEmployeeRows } = await activeEmployeesQ;
  const activeEmployees = activeEmployeeRows ?? [];

  let hoursRows: any[] = [];
  if (employeeIds.length) {
    let hq = supabase
      .from("employee_heures")
      .select("*")
      .eq("mois", mois)
      .eq("annee", annee)
      .in("employee_id", employeeIds);
    if (dossierId) hq = hq.eq("dossier_id", dossierId);
    else hq = hq.is("dossier_id", null);
    const { data } = await hq;
    hoursRows = data ?? [];
  }

  const hoursByEmployee = new Map(hoursRows.map((row: any) => [row.employee_id, row]));
  const employeeById = new Map([...activeEmployees, ...employeeRows].map((emp: any) => [emp.id, emp]));
  const declaredIds = new Set(bulletins.map((b: any) => b.employee_id));
  const joursOuvres = workingDaysInMonth(mois, annee);

  const rows = bulletins
    .map((b: any, index: number) => {
      const emp = employeeById.get(b.employee_id) ?? {};
      const hours = hoursByEmployee.get(b.employee_id);
      const heuresTravaillees = Number(hours?.heures_normales ?? hours?.heures_travaillees ?? hours?.heures_theoriques ?? 0);
      const heuresTheoriques = Number(hours?.heures_theoriques ?? 0);
      const joursDeclares = heuresTheoriques > 0
        ? roundHalf((heuresTravaillees / heuresTheoriques) * joursOuvres)
        : 26;
      const salaireBrut = Number(b.salaire_brut ?? 0);
      const salairePlafonne = Math.min(salaireBrut, 6000);
      const cnssSalarie = round2(salairePlafonne * 0.0448);
      const cnssPatronal = round2(salairePlafonne * 0.2109);
      const amoSalarie = round2(salaireBrut * 0.0226);
      const amoPatronal = round2(salaireBrut * 0.0411);
      const totalCotisations = round2(cnssSalarie + cnssPatronal + amoSalarie + amoPatronal);
      return {
        n: index + 1,
        matricule_cnss: emp.numero_cnss ?? emp.cnss_number ?? emp.matricule ?? "",
        nom: String(emp.nom ?? "").toUpperCase(),
        prenom: emp.prenom ?? "",
        jours_declares: joursDeclares,
        salaire_brut: salaireBrut,
        salaire_plafonne: salairePlafonne,
        cnss_salarie: cnssSalarie,
        cnss_patronal: cnssPatronal,
        amo_salarie: amoSalarie,
        amo_patronal: amoPatronal,
        total_cotisations: totalCotisations,
      };
    })
    .sort((a: any, b: any) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom))
    .map((row: any, index: number) => ({ ...row, n: index + 1 }));

  const totals = rows.reduce((acc: any, row: any) => {
    acc.total_jours += Number(row.jours_declares);
    acc.total_brut += Number(row.salaire_brut);
    acc.total_plafonne += Number(row.salaire_plafonne);
    acc.total_cnss_salarie += Number(row.cnss_salarie);
    acc.total_cnss_patronal += Number(row.cnss_patronal);
    acc.total_amo_salarie += Number(row.amo_salarie);
    acc.total_amo_patronal += Number(row.amo_patronal);
    acc.total_cotisations += Number(row.total_cotisations);
    return acc;
  }, {
    total_jours: 0,
    total_brut: 0,
    total_plafonne: 0,
    total_cnss_salarie: 0,
    total_cnss_patronal: 0,
    total_amo_salarie: 0,
    total_amo_patronal: 0,
    total_cotisations: 0,
  });

  for (const key of Object.keys(totals)) totals[key] = round2(totals[key]);

  const missingBulletins = activeEmployees
    .filter((emp: any) => !declaredIds.has(emp.id))
    .map((emp: any) => ({
      id: emp.id,
      nom: emp.nom,
      prenom: emp.prenom,
      matricule_cnss: emp.numero_cnss ?? emp.cnss_number ?? emp.matricule ?? "",
    }));

  return {
    period: { mois, annee, label: periodLabel },
    company: {
      name: company?.raison_sociale ?? "",
      ice: company?.ice ?? "",
      cnss_number: company?.numero_cnss ?? company?.cnss ?? "",
    },
    employees: rows,
    totals,
    all_validated: rows.length > 0 && missingBulletins.length === 0,
    missing_bulletins: missingBulletins,
  };
}
