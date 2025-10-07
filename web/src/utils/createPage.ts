import { api } from "../api";

type CreatePagePayload = {
  title?: string;
  content?: string;
  tags?: string[];
  format?: "rich" | "latex";
};

export async function createPage({
  title = "Untitled",
  content = "",
  tags = [],
  format,
}: CreatePagePayload = {}) {
  const { data } = await api.post<{ id: string }>("/pages", {
    title,
    content,
    tags,
    format,
  });
  return data.id;
}
