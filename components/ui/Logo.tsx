
import Image from 'next/image';

export function Logo({ className = "w-8 h-8", light = false }: { className?: string, light?: boolean }) {
    // Determine which logo to use. The prompt mentioned "clicr-logo-white.png" exists.
    // Assuming dark background mostly, so white logo is preferred if 'light' is false (wait, usually 'light' means light text/white logo).
    // Let's standardise: 
    // - Default to white logo (for dark mode).
    // - If light theme needed (unlikely in this design), use black.
    // Given the designs are "Rich Aesthetics, Dark Mode", we default to public/clicr-logo-white.png

    return (
        <div className={`relative ${className} flex items-center justify-center`}>
            {/* Using Next.js Image for optimization */}
            <Image
                src="/clicr-logo-white.png"
                alt="CLICR Logo"
                width={100}
                height={100}
                className="object-contain" // Contain within the wrapper dimensions
                priority
            />
        </div>
    );
}
