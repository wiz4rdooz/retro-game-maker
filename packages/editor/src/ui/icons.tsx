import type { ComponentChildren } from 'preact';

/** Strich-Icons nach Entwurf B (24er-Raster, 1,75 px). */
function Icon({ size = 20, children, fill = 'none' }: { size?: number; children: ComponentChildren; fill?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export type IconComponent = (p: { size?: number }) => preact.JSX.Element;

export const IconCube: IconComponent = ({ size }) => (
  <Icon size={size}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9" />
  </Icon>
);
export const IconUndo: IconComponent = ({ size }) => (
  <Icon size={size}>
    <path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
);
export const IconRedo: IconComponent = ({ size }) => (
  <Icon size={size}>
    <path d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Icon>
);
export const IconPlay: IconComponent = ({ size = 16 }) => (
  <Icon size={size} fill="currentColor">
    <path d="M8 5.5v13l10.5-6.5L8 5.5z" />
  </Icon>
);
/** Zeichenebene: ein Rasterfeld schräg von oben. */
export const IconPlane: IconComponent = ({ size }) => (
  <Icon size={size}>
    <path d="M2 12.5L12 7l10 5.5L12 18 2 12.5zM7 9.75l10 5.5M17 9.75l-10 5.5" />
  </Icon>
);
export const IconPencil: IconComponent = ({ size }) => (
  <Icon size={size}>
    <path d="M15.5 4.5l4 4L9 19H5v-4L15.5 4.5zM13.5 6.5l4 4" />
  </Icon>
);
export const IconCursor: IconComponent = ({ size }) => (
  <Icon size={size}>
    <path d="M5 3l14 7-6 2-2 6L5 3z" />
  </Icon>
);
export const IconBucket: IconComponent = ({ size }) => (
  <Icon size={size}>
    <path d="M5 11l6-6 8 8-6 6a2 2 0 0 1-2.8 0L5 13.8a2 2 0 0 1 0-2.8zM5 12.5h13.5M19.5 16.5s1.5 1.8 1.5 3a1.5 1.5 0 0 1-3 0c0-1.2 1.5-3 1.5-3z" />
  </Icon>
);
export const IconPipette: IconComponent = ({ size }) => (
  <Icon size={size}>
    <path d="M14.5 4.5a2.1 2.1 0 0 1 3 0l2 2a2.1 2.1 0 0 1 0 3L17 12l-5-5 2.5-2.5zM12 7l-7 7v5h5l7-7" />
  </Icon>
);
export const IconEraser: IconComponent = ({ size }) => (
  <Icon size={size}>
    <path d="M4 15l9-9 6 6-7 7H8l-4-4zM9.5 9.5l6 6M12 19h8" />
  </Icon>
);
export const IconChevron: IconComponent = ({ size = 16 }) => (
  <Icon size={size}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);
export const IconEye: IconComponent = ({ size = 18 }) => (
  <Icon size={size}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z" />
  </Icon>
);
export const IconClose: IconComponent = ({ size = 16 }) => (
  <Icon size={size}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const IconFolder: IconComponent = ({ size = 18 }) => (
  <Icon size={size}>
    <path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11z" />
  </Icon>
);
export const IconUpload: IconComponent = ({ size = 18 }) => (
  <Icon size={size}>
    <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
  </Icon>
);
export const IconPlus: IconComponent = ({ size = 18 }) => (
  <Icon size={size}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const IconLock: IconComponent = ({ size = 18 }) => (
  <Icon size={size}>
    <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z" />
  </Icon>
);
export const IconTrash: IconComponent = ({ size = 18 }) => (
  <Icon size={size}>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9L17.5 7M10 10.5v6M14 10.5v6" />
  </Icon>
);
export const IconMenu: IconComponent = ({ size = 16 }) => (
  <Icon size={size}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);
