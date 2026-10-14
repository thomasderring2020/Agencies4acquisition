type P = { size?: number };
const base = (size = 14) => ({ width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const IconSearch = ({ size }: P) => (<svg {...base(size)}><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" /></svg>);
export const IconSync = ({ size }: P) => (<svg {...base(size)}><path d="M13.5 6.5A5.5 5.5 0 0 0 3.2 4.8M2.5 9.5a5.5 5.5 0 0 0 10.3 1.7" /><path d="M13.5 2.5v4h-4M2.5 13.5v-4h4" /></svg>);
export const IconClose = ({ size }: P) => (<svg {...base(size)}><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg>);
export const IconExt = ({ size }: P) => (<svg {...base(size)}><path d="M9 3h4v4M13 3 7.5 8.5M11.5 9.5V13h-8.5V4.5H6.5" /></svg>);
export const IconGlobe = ({ size }: P) => (<svg {...base(size)}><circle cx="8" cy="8" r="5.8" /><path d="M2.2 8h11.6M8 2.2c1.8 1.7 2.6 3.6 2.6 5.8S9.8 12.1 8 13.8C6.2 12.1 5.4 10.2 5.4 8S6.2 3.9 8 2.2Z" /></svg>);
export const IconIn = ({ size }: P) => (<svg {...base(size)}><rect x="2.2" y="2.2" width="11.6" height="11.6" rx="1.5" /><path d="M5.2 7v4M5.2 5v.01M8 11V7m0 1.8c0-1 .8-1.8 1.8-1.8s1.6.8 1.6 1.8V11" /></svg>);
export const IconPlus = ({ size }: P) => (<svg {...base(size)}><path d="M8 3v10M3 8h10" /></svg>);
export const IconTrash = ({ size }: P) => (<svg {...base(size)}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" /></svg>);
export const IconEdit = ({ size }: P) => (<svg {...base(size)}><path d="M10.5 2.8 13.2 5.5 6 12.7l-3.2.5.5-3.2z" /></svg>);
export const IconList = ({ size }: P) => (<svg {...base(size)}><path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" /></svg>);
export const IconMap = ({ size }: P) => (<svg {...base(size)}><path d="M2 4l4-1.5 4 1.5 4-1.5v9.5L10 13.5 6 12l-4 1.5z M6 2.5V12M10 4v9.5" /></svg>);
export const IconUpload = ({ size }: P) => (<svg {...base(size)}><path d="M8 10.5V2.5M5 5.5l3-3 3 3M2.5 10.5v3h11v-3" /></svg>);
export const IconFilter = ({ size }: P) => (<svg {...base(size)}><path d="M2.5 3.5h11L9.3 8.6v4.4l-2.6-1.2V8.6z" /></svg>);
export const IconPhone = ({ size }: P) => (<svg {...base(size)}><path d="M4 2.5h2.2l1 3-1.5 1a7 7 0 0 0 3.8 3.8l1-1.5 3 1V12a1.5 1.5 0 0 1-1.6 1.5A10.5 10.5 0 0 1 2.5 4.1 1.5 1.5 0 0 1 4 2.5Z" /></svg>);
export const IconMail = ({ size }: P) => (<svg {...base(size)}><rect x="2" y="3.5" width="12" height="9" rx="1" /><path d="m2.5 4.5 5.5 4.2 5.5-4.2" /></svg>);
export const IconMinus = ({ size }: P) => (<svg {...base(size)}><path d="M3 8h10" /></svg>);
