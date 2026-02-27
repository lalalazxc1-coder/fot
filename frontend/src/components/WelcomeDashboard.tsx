import { useEffect, useRef, useState } from 'react';
import {
    MapPin,
    Calendar,
    Users,
    Gift,
    CheckCircle2,
    Play,
    Download,
    Navigation,
    Clock,
    PartyPopper,
} from 'lucide-react';

// Native confetti — no external dependency
function launchConfetti() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#4f46e5', '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#f97316'];
    const particles = Array.from({ length: 150 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 10 + 5,
        h: Math.random() * 5 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        opacity: 1,
    }));

    let frame = 0;
    const MAX_FRAMES = 200;

    const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotSpeed;
            p.opacity = Math.max(0, 1 - frame / MAX_FRAMES);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.globalAlpha = p.opacity;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        });
        frame++;
        if (frame < MAX_FRAMES) {
            requestAnimationFrame(draw);
        } else {
            canvas.remove();
        }
    };
    requestAnimationFrame(draw);
}

interface TeamMember {
    name: string;
    role: string;
    description?: string;
}

interface WelcomeContent {
    video_url?: string;
    office_tour_images?: string[];
    address?: string;
    first_day_instructions?: string[];
    merch_info?: string;
    team_members?: TeamMember[];
    company_description?: string;
    mission?: string;
    vision?: string;
}

interface WelcomeDashboardProps {
    candidateName: string;
    positionTitle: string;
    companyName: string;
    startDate?: string;
    welcomeContent?: WelcomeContent | null;
}

function getEmbedUrl(url: string): string | null {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&rel=0`;
    const vmMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;
    return url;
}

function generateICS(startDate: string, candidateName: string, companyName: string, positionTitle: string): string {
    const date = new Date(startDate);
    const dateStr = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endDate = new Date(date);
    endDate.setHours(endDate.getHours() + 9);
    const endStr = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//FOT Welcome//RU',
        'BEGIN:VEVENT',
        `DTSTART:${dateStr}`,
        `DTEND:${endStr}`,
        `SUMMARY:Первый рабочий день в ${companyName}`,
        `DESCRIPTION:Кандидат: ${candidateName}\\nДолжность: ${positionTitle}\\nДобро пожаловать в команду ${companyName}!`,
        `ORGANIZER;CN=${companyName}:mailto:hr@company.com`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n');
}

export default function WelcomeDashboard({
    candidateName,
    positionTitle,
    companyName,
    startDate,
    welcomeContent,
}: WelcomeDashboardProps) {
    const confettiFired = useRef(false);
    const [activeImage, setActiveImage] = useState(0);
    const [videoPlaying, setVideoPlaying] = useState(false);

    useEffect(() => {
        if (confettiFired.current) return;
        confettiFired.current = true;
        launchConfetti();
    }, []);

    const handleDownloadICS = () => {
        if (!startDate) return;
        const ics = generateICS(startDate, candidateName, companyName, positionTitle);
        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `first-day-${companyName.replace(/\s+/g, '-')}.ics`;
        link.click();
    };

    const embedUrl = welcomeContent?.video_url ? getEmbedUrl(welcomeContent.video_url) : null;
    const images = welcomeContent?.office_tour_images || [];
    const instructions = welcomeContent?.first_day_instructions || [];
    const teamMembers = welcomeContent?.team_members || [];

    const formatDate = (d: string) => {
        try {
            return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch { return d; }
    };

    return (
        <div className="welcome-dashboard min-h-screen bg-[#f8fafc] font-sans">
            <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-4">

                {/* Hero Card */}
                <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm p-6 sm:p-8">
                    <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                            <PartyPopper className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Предложение принято</span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2 leading-tight">
                        Добро пожаловать, {candidateName}!
                    </h1>
                    <p className="text-slate-500 text-sm sm:text-base font-medium max-w-xl mb-5">
                        Вы приняли предложение на позицию{' '}
                        <span className="text-slate-900 font-bold">{positionTitle}</span>{' '}
                        в компании{' '}
                        <span className="text-slate-900 font-bold">{companyName}</span>
                    </p>

                    {startDate && (
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Дата выхода</p>
                                    <p className="text-xs font-black text-slate-900">{formatDate(startDate)}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleDownloadICS}
                                className="bg-slate-900 text-white rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm active:scale-95"
                                id="btn-add-to-calendar"
                            >
                                <Download className="w-3 h-3" />
                                В календарь
                            </button>
                        </div>
                    )}
                </section>

                {/* Company Info */}
                {(welcomeContent?.company_description || welcomeContent?.mission || welcomeContent?.vision) && (
                    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                                <Users className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <h2 className="font-bold text-slate-900 text-sm">О компании</h2>
                        </div>
                        <div className="px-5 py-4 space-y-3">
                            {welcomeContent?.company_description && (
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    {welcomeContent.company_description}
                                </p>
                            )}
                            {(welcomeContent?.mission || welcomeContent?.vision) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {welcomeContent?.mission && (
                                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Миссия</p>
                                            <p className="text-slate-700 text-xs leading-relaxed">{welcomeContent.mission}</p>
                                        </div>
                                    )}
                                    {welcomeContent?.vision && (
                                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Видение</p>
                                            <p className="text-slate-700 text-xs leading-relaxed">{welcomeContent.vision}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Video Tour */}
                {embedUrl && (
                    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                                <Play className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <h2 className="font-bold text-slate-900 text-sm">Видео-тур по офису</h2>
                        </div>
                        <div className="relative aspect-video bg-slate-50">
                            {!videoPlaying ? (
                                <button
                                    onClick={() => setVideoPlaying(true)}
                                    className="absolute inset-0 flex flex-col items-center justify-center group"
                                    id="btn-play-video-tour"
                                >
                                    <div className="w-14 h-14 bg-slate-900 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                    </div>
                                    <span className="mt-2 text-xs text-slate-400 font-medium">Нажмите для просмотра</span>
                                </button>
                            ) : (
                                <iframe
                                    src={embedUrl + (embedUrl.includes('?') ? '&autoplay=1' : '?autoplay=1')}
                                    className="w-full h-full"
                                    allow="autoplay; fullscreen"
                                    allowFullScreen
                                />
                            )}
                        </div>
                    </section>
                )}

                {/* Office Images */}
                {images.length > 0 && (
                    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                                <Navigation className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <h2 className="font-bold text-slate-900 text-sm">Фото офиса</h2>
                        </div>
                        <div className="p-4 space-y-2">
                            <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden">
                                <img
                                    src={images[activeImage]}
                                    alt="Офис"
                                    className="w-full h-full object-cover"
                                    onError={(e: any) => { e.target.style.display = 'none'; }}
                                />
                            </div>
                            {images.length > 1 && (
                                <div className="flex gap-1.5 overflow-x-auto pb-1">
                                    {images.map((img, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setActiveImage(i)}
                                            className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === activeImage ? 'border-slate-900' : 'border-slate-200 opacity-60'}`}
                                        >
                                            <img src={img} alt="" className="w-full h-full object-cover"
                                                onError={(e: any) => { e.target.style.display = 'none'; }} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Compact info rows: Address + Welcome Pack */}
                {(welcomeContent?.address || welcomeContent?.merch_info) && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
                        {welcomeContent?.address && (
                            <div className="px-5 py-3.5 flex items-center gap-3">
                                <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 flex-shrink-0">
                                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Адрес офиса</p>
                                    <p className="text-slate-900 font-semibold text-sm">{welcomeContent.address}</p>
                                </div>
                            </div>
                        )}
                        {welcomeContent?.merch_info && (
                            <div className="px-5 py-3.5 flex items-center gap-3">
                                <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 flex-shrink-0">
                                    <Gift className="w-3.5 h-3.5 text-slate-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Welcome Pack</p>
                                    <p className="text-slate-700 text-sm font-medium">{welcomeContent.merch_info}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* First Day Instructions */}
                {instructions.length > 0 && (
                    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <h2 className="font-bold text-slate-900 text-sm">Твой первый день</h2>
                        </div>
                        <div className="px-5 py-4 space-y-2">
                            {instructions.map((instruction, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="w-5 h-5 bg-slate-50 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 border border-slate-100">
                                        <CheckCircle2 className="w-3 h-3 text-slate-400" />
                                    </div>
                                    <p className="text-slate-700 text-sm font-medium leading-snug">{instruction}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Team Hierarchy */}
                {teamMembers.length > 0 && (
                    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                                <Users className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <h2 className="font-bold text-slate-900 text-sm">Наша команда</h2>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {teamMembers.map((member, i) => (
                                    <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100 hover:shadow-sm transition-shadow">
                                        <div className="flex items-center gap-2.5 mb-2">
                                            <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 font-black text-xs flex-shrink-0">
                                                {member.name ? member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '—'}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-slate-900 font-bold text-xs truncate">{member.name}</p>
                                                <p className="text-slate-500 text-[11px] truncate">{member.role}</p>
                                            </div>
                                        </div>
                                        {member.description && (
                                            <p className="text-slate-500 text-[11px] leading-relaxed border-t border-slate-100 pt-2">
                                                {member.description}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* Footer */}
                <div className="text-center pt-4 pb-3 text-slate-400 text-xs font-medium">
                    С нетерпением ждём вашего первого дня в команде {companyName}
                </div>
            </div>
        </div>
    );
}
