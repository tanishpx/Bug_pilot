type BrandMarkProps = {
  className?: string;
  title?: string;
};

/**
 * BugPilot brand mark matching the browser tab's favicon logo.
 */
export default function BrandMark({ className = "", title = "BugPilot" }: BrandMarkProps) {
  return (
    <svg
      className={`brand-mark ${className}`.trim()}
      viewBox="0 0 200 200"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="200" height="200" rx="36" fill="url(#bp-tab-gradient)" />
      <defs>
        <linearGradient id="bp-tab-gradient" gradientTransform="rotate(45 0.5 0.5)">
          <stop offset="0%" stopColor="#000000" />
          <stop offset="100%" stopColor="#211c36" />
        </linearGradient>
      </defs>
      <g>
        <g
          fill="#ffffff"
          transform="matrix(11.252747252747254,0,0,11.252747252747254,25.954888942477467,180.0064093359224)"
          stroke="#cecc7b"
          strokeWidth="0.2"
        >
          <path d="M6.85 0L1.07 0L1.07-14.22L6.18-14.22Q8.93-14.22 10.36-13.21Q11.79-12.21 11.79-10.29L11.79-10.29Q11.79-9.19 11.28-8.41Q10.77-7.63 9.79-7.26L9.79-7.26Q10.90-6.96 11.49-6.16Q12.09-5.36 12.09-4.21L12.09-4.21Q12.09-2.12 10.77-1.07Q9.44-0.02 6.85 0L6.85 0ZM6.90-6.04L4.50-6.04L4.50-2.64L6.75-2.64Q7.68-2.64 8.17-3.06Q8.67-3.49 8.67-4.26L8.67-4.26Q8.67-6.04 6.90-6.04L6.90-6.04ZM4.50-11.57L4.50-8.29L6.29-8.29Q7.41-8.30 7.89-8.70Q8.37-9.10 8.37-9.88L8.37-9.88Q8.37-10.78 7.85-11.18Q7.33-11.57 6.18-11.57L6.18-11.57L4.50-11.57Z" />
        </g>
      </g>
    </svg>
  );
}

