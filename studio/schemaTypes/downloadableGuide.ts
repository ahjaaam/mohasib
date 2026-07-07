import { DocumentTextIcon } from "@sanity/icons";
import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "guide",
  title: "Document téléchargeable",
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
      name: "active",
      title: "Publié sur le site",
      type: "boolean",
      initialValue: true,
      description: "Désactivez ce champ pour masquer le document sans le supprimer.",
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "file",
      title: "Fichier à télécharger",
      type: "file",
      description: "Recommandé : téléversez ici le document final. Formats acceptés : PDF, Word, Excel, CSV, PowerPoint, OpenDocument et fichiers ZIP.",
    }),
    defineField({
      name: "fileUrl",
      title: "Lien externe du document",
      type: "url",
      description: "Optionnel. À utiliser seulement si le document est hébergé ailleurs.",
    }),
    defineField({
      name: "pages",
      title: "Nombre de pages",
      type: "string",
      description: "Exemple: 12 pages",
    }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: {
        layout: "tags",
      },
    }),
    defineField({
      name: "publishedAt",
      title: "Date de publication",
      type: "datetime",
    }),
    defineField({
      name: "sortOrder",
      title: "Ordre d'affichage",
      type: "number",
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
      subtitle: "pages",
    },
  },
});
