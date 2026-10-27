import { createContext, useContext } from 'react';

// True inside the panel's main block (AuthenticatedLayout wraps SidebarInset with the provider).
// Shared ui components switch to the Qadam look there; the sidebar, public pages and the login page
// render outside the provider and keep their current styles.
const PanelDesignContext = createContext(false);

export function PanelDesignProvider({ children }) {
    return <PanelDesignContext.Provider value>{children}</PanelDesignContext.Provider>;
}

export function usePanelDesign() {
    return useContext(PanelDesignContext);
}
