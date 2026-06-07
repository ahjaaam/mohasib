import { DocumentTextIcon } from "@sanity/icons";
import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "post",
  title: "Article de blog",
  type: "document",
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: "title",
      title: "Titre",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug URL",
      type: "slug",
      options: { source: "title" },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "category",
      title: "Catégorie",
      type: "string",
      options: {
        list: [
          { title: "TVA", value: "tva" },
          { title: "IS", value: "is" },
          { title: "Paie", value: "paie" },
          { title: "Trésorerie", value: "tresorerie" },
          { title: "Création", value: "creation" },
          { title: "Comptabilité", value: "comptabilite" },
        ],
      },
    }),
    defineField({
      name: "excerpt",
      title: "Résumé",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "coverImage",
      title: "Image de couverture",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "readTime",
      title: "Temps de lecture (minutes)",
      type: "number",
    }),
    defineField({
      name: "publishedAt",
      title: "Date de publication",
      type: "datetime",
    }),
    defineField({
      name: "body",
      title: "Contenu",
      type: "array",
      of: [
        defineArrayMember({ type: "block" }),
        defineArrayMember({ type: "image" }),
        defineArrayMember({
          type: "object",
          name: "callout",
          title: "Encadré info",
          fields: [
            defineField({ name: "text", type: "text", title: "Texte" }),
            defineField({
              name: "type",
              type: "string",
              title: "Type",
              options: { list: ["info", "warning", "tip"] },
            }),
          ],
        }),
      ],
    }),
    defineField({
      name: "seoTitle",
      title: "SEO — Titre",
      type: "string",
    }),
    defineField({
      name: "seoDescription",
      title: "SEO — Description",
      type: "text",
      rows: 2,
    }),
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "category",
      media: "coverImage",
    },
  },
});
