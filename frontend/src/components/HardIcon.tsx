/**
 * A reliable hard currency (gem/diamond) icon component that renders as an inline SVG.
 */
export function HardIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`inline-block align-middle ${className}`}
            style={{ marginBottom: 2 }}
        >
            <path 
                d="M12 2L4.5 9L12 22L19.5 9L12 2Z" 
                fill="#3B82F6" 
                stroke="#1E40AF" 
                strokeWidth="1.5" 
                strokeLinejoin="round" 
            />
            <path 
                d="M12 2L8 9H16L12 2Z" 
                fill="#60A5FA" 
                fillOpacity="0.4"
            />
            <path 
                d="M8 9L12 22L16 9H8Z" 
                fill="#2563EB" 
                fillOpacity="0.4"
            />
        </svg>
    );
}
