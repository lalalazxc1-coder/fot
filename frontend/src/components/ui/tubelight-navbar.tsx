"use client"

import React, { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
    name: string
    url: string
    icon: LucideIcon
}

interface NavBarProps {
    items: NavItem[]
    className?: string
}

export function NavBar({ items, className }: NavBarProps) {
    const location = useLocation()
    const [activeTab, setActiveTab] = useState(() => {
        const found = items.find(item => location.pathname.startsWith(item.url) && item.url !== '/') || items.find(item => item.url === location.pathname)
        return found ? found.name : ""
    })

    useEffect(() => {
        // Prioritize exact match, then visible sub-path match
        const found = items.find(item => item.url === location.pathname) ||
            items.find(item => location.pathname.startsWith(item.url) && item.url !== '/')

        setActiveTab(found ? found.name : "")
    }, [location.pathname, items])

    return (
        <div
            className={cn(
                "fixed bottom-0 sm:top-0 left-1/2 -translate-x-1/2 z-50 mb-6 sm:pt-6",
                className,
            )}
        >
            <div className="flex items-center gap-3 bg-background/5 border border-border backdrop-blur-lg py-1 px-1 rounded-full shadow-lg">
                {items.map((item) => {
                    const Icon = item.icon
                    const isActive = activeTab === item.name

                    return (
                        <Link
                            key={item.name}
                            to={item.url}
                            onClick={() => setActiveTab(item.name)}
                            className={cn(
                                "relative cursor-pointer text-sm font-semibold px-6 py-2 rounded-full transition-all duration-300 ease-out",
                                "text-slate-500 hover:text-slate-900 hover:bg-white/20",
                                isActive && "bg-white text-slate-900 shadow-sm ring-1 ring-black/5",
                            )}
                        >
                            <span className="hidden md:inline">{item.name}</span>
                            <span className="md:hidden">
                                <Icon size={18} strokeWidth={2.5} />
                            </span>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
