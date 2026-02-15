import { createContext, useContext, useState, ReactNode } from 'react';

interface SnapshotContextType {
    snapshotDate: string | null;
    setSnapshotDate: (date: string | null) => void;
}

const SnapshotContext = createContext<SnapshotContextType | undefined>(undefined);

export const SnapshotProvider = ({ children }: { children: ReactNode }) => {
    const [snapshotDate, setSnapshotDate] = useState<string | null>(null);

    return (
        <SnapshotContext.Provider value={{ snapshotDate, setSnapshotDate }}>
            {children}
        </SnapshotContext.Provider>
    );
};

export const useSnapshot = () => {
    const context = useContext(SnapshotContext);
    if (!context) throw new Error('useSnapshot must be used within SnapshotProvider');
    return context;
};
