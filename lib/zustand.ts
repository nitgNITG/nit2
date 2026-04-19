import { create } from 'zustand'

export const useStore = create((set) => ({
    projects: [],
    sponsers: [],
    apps: [],
    editProject: null,
    dashboard: [],
    contacts: [],
    unReadContact: 0,
    articles: [],
    sections: [],
    editSection: null,

    // Sections
    setEditSection: (section: any) => set(() => ({ editSection: section })),
    setSections: (sections: any) => set(() => ({ sections })),
    setSection: (section: any) => set((state: any) => ({ sections: [...state.sections, section] })),
    updateSection: (section: any) => set((state: any) => ({
        sections: state.sections.map((s: any) => s.id === section.id ? section : s)
    })),
    deleteSection: (id: any) => set((state: any) => ({
        sections: state.sections.filter((s: any) => s.id !== id)
    })),

    // Articles — BUG FIX: setArticle was using wrong key 'article' instead of 'articles'
    setArticles: (articles: any) => set(() => ({ articles })),
    setArticle: (article: any) => set((state: any) => ({ articles: [...state.articles, article] })),
    addArticle: (article: any) => set((state: any) => ({ articles: [...state.articles, article] })),
    updateArticle: (article: any) => set((state: any) => ({
        articles: state.articles.map((a: any) => a.id === article.id ? article : a)
    })),
    deleteArticle: (id: any) => set((state: any) => ({
        articles: state.articles.filter((a: any) => a.id !== id)
    })),

    // Contacts
    setUnReadContact: (count: any) => set(() => ({ unReadContact: count })),
    setContacts: (contacts: any) => set(() => ({ contacts })),
    setContact: (contact: any) => set((state: any) => ({ contacts: [...state.contacts, contact] })),

    // Dashboard
    setDashboard: (data: any) => set(() => ({ dashboard: data })),

    // Apps — BUG FIX: all mutations now return new arrays (immutable)
    setApps: (apps: any) => set(() => ({ apps })),
    addApp: (app: any) => set((state: any) => ({ apps: [...state.apps, app] })),
    updateApp: (app: any) => set((state: any) => ({
        apps: state.apps.map((a: any) => a.id === app.id ? app : a)
    })),
    deleteApp: (id: any) => set((state: any) => ({
        apps: state.apps.filter((a: any) => a.id !== id)
    })),

    // Projects — BUG FIX: all mutations now return new arrays (immutable)
    setProjects: (projects: any) => set(() => ({ projects })),
    addProject: (project: any) => set((state: any) => ({ projects: [...state.projects, project] })),
    setEditProject: (project: any) => set(() => ({ editProject: project })),
    updateProject: (project: any) => set((state: any) => ({
        projects: state.projects.map((p: any) => p.id === project.id ? project : p)
    })),
    deleteProject: (id: any) => set((state: any) => ({
        projects: state.projects.filter((p: any) => p.id !== id)
    })),

    // Sponsers
    setSponsers: (sponsers: any) => set(() => ({ sponsers })),
    setSponser: (sponser: any) => set((state: any) => ({ sponsers: [...state.sponsers, sponser] })),
    deleteSponser: (id: any) => set((state: any) => ({
        sponsers: state.sponsers.filter((s: any) => s.id !== id)
    })),
}))
