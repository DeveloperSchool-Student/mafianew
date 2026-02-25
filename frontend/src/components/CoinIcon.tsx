/**
 * A reliable coin icon component that renders as an inline SVG.
 * Replaces the 🪙 emoji which is not supported in all browsers/fonts.
 */
export function CoinIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
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
            {/* Outer circle (coin body) */}
            <circle cx="12" cy="12" r="10" fill="#EAB308" stroke="#CA8A04" strokeWidth="1.5" />
            {/* Inner circle ring */}
            <circle cx="12" cy="12" r="7.5" fill="none" stroke="#CA8A04" strokeWidth="1" opacity="0.6" />
            {/* Dollar sign / Currency symbol */}
            <text
                x="12"
                y="16.5"
                textAnchor="middle"
                fontWeight="bold"
                fontSize="12"
                fill="#92400E"
                fontFamily="Arial, sans-serif"
            >
                $
            </text>
        </svg>
    );
}
