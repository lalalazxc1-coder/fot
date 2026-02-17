"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOnClickOutside } from "usehooks-ts";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface Tab {
    title: string;
    icon: LucideIcon;
    type?: never;
    id?: string;
    onClick?: () => void;
    badge?: number | string;
}

export interface Separator {
    type: "separator";
    title?: never;
    icon?: never;
    id?: never;
}

export type TabItem = Tab | Separator;

interface ExpandableTabsProps {
    tabs: TabItem[];
    className?: string;
    activeColor?: string;
    onChange?: (index: number | null) => void;
    selectedIndex?: number | null;
    disableOutsideClick?: boolean;
}

const buttonVariants = {
    initial: {
        gap: 0,
        paddingLeft: ".5rem",
        paddingRight: ".5rem",
    },
    animate: (isSelected: boolean) => ({
        gap: isSelected ? ".5rem" : 0,
        paddingLeft: isSelected ? "1rem" : ".5rem",
        paddingRight: isSelected ? "1rem" : ".5rem",
    }),
};

const spanVariants = {
    initial: { width: 0, opacity: 0 },
    animate: { width: "auto", opacity: 1 },
    exit: { width: 0, opacity: 0 },
};

const transition = { delay: 0.1, type: "spring", bounce: 0, duration: 0.6 } as const;

export function ExpandableTabs({
    tabs,
    className,
    activeColor = "text-primary",
    onChange,
    selectedIndex,
    disableOutsideClick = false
}: ExpandableTabsProps) {
    const [selected, setSelected] = React.useState<number | null>(selectedIndex !== undefined ? selectedIndex : null);
    const outsideClickRef = React.useRef(null);

    React.useEffect(() => {
        if (selectedIndex !== undefined) {
            setSelected(selectedIndex);
        }
    }, [selectedIndex]);

    useOnClickOutside(outsideClickRef, () => {
        if (!disableOutsideClick) {
            setSelected(null);
            onChange?.(null);
        }
    });

    const handleSelect = (index: number, tab: Tab) => {
        setSelected(index);
        onChange?.(index);
        tab.onClick?.();
    };

    const Separator = () => (
        <div className="mx-1 h-[24px] w-[1.2px] bg-border" aria-hidden="true" />
    );

    return (
        <div
            ref={outsideClickRef}
            className={cn(
                "flex flex-wrap items-center gap-2 rounded-2xl border bg-background/50 p-1 shadow-sm backdrop-blur-md",
                className
            )}
        >
            {tabs.map((tab, index) => {
                if (tab.type === "separator") {
                    return <Separator key={`separator-${index}`} />;
                }

                const Icon = tab.icon;
                return (
                    <motion.button
                        key={tab.title}
                        variants={buttonVariants}
                        initial={false}
                        animate="animate"
                        custom={selected === index}
                        onClick={() => handleSelect(index, tab as Tab)}
                        transition={transition}
                        className={cn(
                            "relative flex items-center rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-300",
                            selected === index
                                ? cn("bg-muted", activeColor)
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <div className="relative flex items-center">
                            <Icon size={20} />
                            {/* Badge Indicator */}
                            {tab.badge ? (
                                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
                                    {typeof tab.badge === 'number' && tab.badge > 9 ? '' : ''}
                                </span>
                            ) : null}
                        </div>
                        <AnimatePresence initial={false}>
                            {selected === index && (
                                <motion.span
                                    variants={spanVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    transition={transition}
                                    className="overflow-hidden whitespace-nowrap"
                                >
                                    {tab.title}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.button>
                );
            })}
        </div>
    );
}
