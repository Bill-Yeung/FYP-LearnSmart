
import { deleteTemplate, duplicateTemplate, listTemplates } from "../api/gameTemplates"

interface TemplateItem {
	id: string
	name: string
	subject: string
	status: "published" | "draft" | "ready" | "archived"
	lastModified: string
}

// duplicate a template on the server then re-fetch the list to refresh the ui
export async function handleDuplicate(id: string, setTemplates: React.Dispatch<React.SetStateAction<TemplateItem[]>>) {
	try {
		await duplicateTemplate(id)
		const data = await listTemplates()
		const mapped: TemplateItem[] = data.map(t => ({
			id: t.id,
			name: t.name,
			subject:
				t.subject_code && t.subject_name
					? `${t.subject_code} – ${t.subject_name}`
					: t.subject_code || t.subject_name || "(no subject)",
			status: (t.status ?? "draft") as TemplateItem["status"],
			lastModified: (t.updated_at || t.created_at).slice(0, 10),
		}))
		setTemplates(mapped)
	} catch (e) {
		console.error("Failed to duplicate template", e)
	}
}

export async function handleDelete(id: string, setTemplates: React.Dispatch<React.SetStateAction<TemplateItem[]>>) {
	const ok = confirm("Are you sure you want to delete this template? This action cannot be undone.")
	if (!ok) return
	try {
		await deleteTemplate(id)
		setTemplates(prev => prev.filter(t => t.id !== id))
	} catch (e) {
		console.error("Failed to delete template", e)
	}
}
