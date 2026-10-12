import React, { Fragment, useEffect } from 'react';
import { Check, Crop, Eraser, MousePointer, PenTool, Shapes, Type } from 'lucide-react';
import type { ToolId } from './studioTypes';

export interface StudioToolDefinition {
  id: ToolId;
  label: string;
  hint: string;
  shortcut?: string;
  icon: React.ReactNode;
}

export interface StudioToolGroup {
  id: string;
  label: string;
  tools: StudioToolDefinition[];
}

/** Tools grouped the way a photo editor groups them: navigate, transform, paint, draw. */
export const STUDIO_TOOL_GROUPS: StudioToolGroup[] = [
  {
    id: 'navigate',
    label: 'Navigate',
    tools: [
      { id: 'move', label: 'Move / Select', hint: 'Drag to pan the canvas', shortcut: 'V', icon: <MousePointer className="h-4 w-4" /> },
    ],
  },
  {
    id: 'transform',
    label: 'Transform',
    tools: [
      { id: 'crop', label: 'Crop & Rotate', hint: 'Choose a print size and rotate', shortcut: 'C', icon: <Crop className="h-4 w-4" /> },
    ],
  },
  {
    id: 'paint',
    label: 'Paint',
    tools: [
      { id: 'brush', label: 'Brush', hint: 'Paint freehand marks', shortcut: 'B', icon: <PenTool className="h-4 w-4" /> },
      { id: 'eraser', label: 'Eraser', hint: 'Drag to remove marks', shortcut: 'E', icon: <Eraser className="h-4 w-4" /> },
    ],
  },
  {
    id: 'draw',
    label: 'Draw',
    tools: [
      { id: 'shape', label: 'Shapes', hint: 'Draw a rectangle or oval', shortcut: 'S', icon: <Shapes className="h-4 w-4" /> },
      { id: 'text', label: 'Text', hint: 'Add a watermark caption', shortcut: 'T', icon: <Type className="h-4 w-4" /> },
    ],
  },
];

export const STUDIO_TOOLS: StudioToolDefinition[] = STUDIO_TOOL_GROUPS.flatMap(group => group.tools);

export function getStudioTool(id: ToolId): StudioToolDefinition {
  return STUDIO_TOOLS.find(tool => tool.id === id) ?? STUDIO_TOOLS[0];
}

/* --------------------------------------------------------------- tools */

interface ColorControlProps {
  foreground: string;
  background: string;
  onForegroundChange: (color: string) => void;
  onBackgroundChange: (color: string) => void;
  onSwap: () => void;
}

const ColorControl: React.FC<ColorControlProps> = ({
  foreground,
  background,
  onForegroundChange,
  onBackgroundChange,
  onSwap,
}) => (
  <div className="flex items-center gap-1.5">
    <div className="relative h-7 w-7 shrink-0" title="Foreground and background colors">
      <label
        className="absolute bottom-0 right-0 z-0 block h-[18px] w-[18px] cursor-pointer overflow-hidden rounded-[5px] border border-border-primary shadow-sm"
        title="Canvas background color"
      >
        <span className="block h-full w-full" style={{ backgroundColor: background }} />
        <input
          type="color"
          value={background}
          onChange={event => onBackgroundChange(event.target.value)}
          aria-label="Canvas background color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <label
        className="absolute left-0 top-0 z-10 block h-[18px] w-[18px] cursor-pointer overflow-hidden rounded-[5px] border border-border-primary shadow-sm"
        title="Foreground (brush) color"
      >
        <span className="block h-full w-full" style={{ backgroundColor: foreground }} />
        <input
          type="color"
          value={foreground}
          onChange={event => onForegroundChange(event.target.value)}
          aria-label="Foreground brush color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
    <button
      type="button"
      onClick={onSwap}
      title="Swap foreground and background colors"
      aria-label="Swap colors"
      className="grid h-6 w-6 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
    >
      <span aria-hidden="true" className="text-xs leading-none">⇄</span>
    </button>
  </div>
);

interface ToolRailProps {
  orientation: 'vertical' | 'horizontal';
  activeTool: ToolId;
  onSelectTool: (tool: ToolId) => void;
  foreground: string;
  background: string;
  onForegroundChange: (color: string) => void;
  onBackgroundChange: (color: string) => void;
  onSwapColors: () => void;
  className?: string;
}

export const StudioToolRail: React.FC<ToolRailProps> = ({
  orientation,
  activeTool,
  onSelectTool,
  foreground,
  background,
  onForegroundChange,
  onBackgroundChange,
  onSwapColors,
  className = '',
}) => {
  const vertical = orientation === 'vertical';
  return (
    <nav
      aria-label="Editor tools"
      className={[
        // Display is supplied by `className` so responsive `hidden`/`flex`
        // variants are not overridden by a base display utility.
        'shrink-0 border-border-primary bg-surface',
        vertical
          ? 'w-12 flex-col items-center gap-0.5 border-r py-2'
          : 'flex-row items-center gap-1 overflow-x-auto border-t px-2 py-1.5',
        className,
      ].join(' ')}
    >
      {STUDIO_TOOL_GROUPS.map((group, groupIndex) => (
        <Fragment key={group.id}>
          {vertical && groupIndex > 0 && <span className="my-1 h-px w-6 bg-border-secondary" aria-hidden="true" />}
          {group.tools.map(tool => (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool(tool.id)}
              title={`${tool.label} — ${tool.hint}${tool.shortcut ? ` [${tool.shortcut}]` : ''}`}
              aria-label={tool.label}
              aria-pressed={activeTool === tool.id}
              className={`relative grid place-items-center rounded-[10px] transition-all duration-150 ${
                vertical ? 'h-9 w-9' : 'h-9 w-9 shrink-0'
              } ${
                activeTool === tool.id
                  ? 'bg-brand-soft text-brand shadow-[inset_0_0_0_1px_rgba(20,184,166,0.25)]'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`}
            >
              {tool.icon}
              {vertical && tool.shortcut && (
                <span className="absolute bottom-0.5 right-0.5 rounded bg-surface-elevated/90 px-0.5 font-mono text-[9px] text-text-tertiary/70 backdrop-blur-sm">
                  {tool.shortcut}
                </span>
              )}
            </button>
          ))}
        </Fragment>
      ))}

      <div className={vertical ? 'mt-auto flex flex-col items-center gap-2 pt-2' : 'ml-auto shrink-0 pl-2'}>
        <ColorControl
          foreground={foreground}
          background={background}
          onForegroundChange={onForegroundChange}
          onBackgroundChange={onBackgroundChange}
          onSwap={onSwapColors}
        />
      </div>
    </nav>
  );
};

/* -------------------------------------------------------------- menu bar */

export interface StudioMenuItem {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  checked?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

export interface StudioMenu {
  id: string;
  label: string;
  items: StudioMenuItem[];
}

interface MenuBarProps {
  menus: StudioMenu[];
  openMenuId: string | null;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
}

export const StudioMenuBar: React.FC<MenuBarProps> = ({ menus, openMenuId, onToggleMenu, onCloseMenu }) => {
  useEffect(() => {
    if (!openMenuId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseMenu();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openMenuId, onCloseMenu]);

  return (
    <div className="relative flex items-center gap-0.5" role="menubar">
      {menus.map(menu => (
        <div key={menu.id} className="relative">
          <button
            type="button"
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={openMenuId === menu.id}
            onClick={() => onToggleMenu(menu.id)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              openMenuId === menu.id
                ? 'bg-brand-soft text-brand'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            {menu.label}
          </button>

          {openMenuId === menu.id && (
            <div className="absolute left-0 top-full z-40 mt-1 w-60 rounded-xl border border-border-primary bg-surface-elevated p-1 shadow-xl">
              {menu.items.map(item => (
                <Fragment key={item.id}>
                  {item.separatorBefore && <div className="my-1 h-px bg-border-secondary" aria-hidden="true" />}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      onCloseMenu();
                      item.onSelect();
                    }}
                    className={`flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      item.danger
                        ? 'text-error hover:bg-error-bg'
                        : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                    }`}
                  >
                    <span className="grid w-3.5 shrink-0 place-items-center">
                      {item.checked ? <Check className="h-3.5 w-3.5 text-brand" /> : null}
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.hint && <span className="font-mono text-[10px] text-text-tertiary">{item.hint}</span>}
                  </button>
                </Fragment>
              ))}
            </div>
          )}
        </div>
      ))}

      {openMenuId && <div className="fixed inset-0 z-30" onClick={onCloseMenu} aria-hidden="true" />}
    </div>
  );
};

/* ------------------------------------------------------------ status bar */

interface StatusBarProps {
  toolLabel: string;
  zoomPercent: number;
  canvasSize: string;
  cursorLabel: string;
  rotationLabel: string;
  documentLabel: string;
  fileSizeLabel?: string;
}

const StatusItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <span className="flex items-center gap-1 whitespace-nowrap">
    <span className="text-text-tertiary">{label}</span>
    <span className="font-mono tabular-nums text-text-secondary">{value}</span>
  </span>
);

const StatusDivider: React.FC = () => <span className="h-3.5 w-px shrink-0 bg-border-secondary" aria-hidden="true" />;

export const StudioStatusBar: React.FC<StatusBarProps> = ({
  toolLabel,
  zoomPercent,
  canvasSize,
  cursorLabel,
  rotationLabel,
  documentLabel,
  fileSizeLabel,
}) => (
  <footer className="flex h-7 shrink-0 items-center gap-3 overflow-x-auto border-t border-border-primary bg-surface px-3 text-[11px]">
    <span className="whitespace-nowrap font-medium text-text-primary">{toolLabel}</span>
    <StatusDivider />
    <StatusItem label="Zoom" value={`${zoomPercent}%`} />
    <StatusItem label="Size" value={canvasSize} />
    <StatusItem label="Cursor" value={cursorLabel} />
    <StatusItem label="Rotate" value={rotationLabel} />
    {fileSizeLabel && <StatusItem label="File" value={fileSizeLabel} />}
    <span className="ml-auto truncate text-text-tertiary">{documentLabel}</span>
  </footer>
);
