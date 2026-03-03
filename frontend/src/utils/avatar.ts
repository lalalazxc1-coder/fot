export const getApiOrigin = (): string => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (!envUrl) return '';
    return envUrl.replace(/\/$/, '').replace(/\/api$/, '');
};

export const resolveAvatarUrl = (avatarUrl: string | null | undefined): string => {
    if (!avatarUrl) return '';
    if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;

    if (avatarUrl.startsWith('/uploads')) {
        return avatarUrl;
    }

    const origin = getApiOrigin();
    return origin ? `${origin}${avatarUrl}` : avatarUrl;
};
