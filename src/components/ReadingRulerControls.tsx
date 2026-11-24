export const RULER_COLORS = [
  { name: "Gold", value: "#ffc444" }, { name: "Yellow", value: "#fff35c" },
  { name: "Orange", value: "#ff9234" }, { name: "Red", value: "#ed5555" },
  { name: "Pink", value: "#ff83be" }, { name: "Magenta", value: "#d65cdb" },
  { name: "Purple", value: "#9778e8" }, { name: "Indigo", value: "#626bd8" },
  { name: "Blue", value: "#528ff0" }, { name: "Cyan", value: "#42c9e8" },
  { name: "Teal", value: "#31bda6" }, { name: "Green", value: "#64c878" },
  { name: "Lime", value: "#ade45d" }, { name: "Brown", value: "#b98961" },
  { name: "Black", value: "#000000" }, { name: "White", value: "#ffffff" },
] as const;

interface ReadingRulerSettingsProps {
  dragMode: boolean;
  onDragModeChange: (value: boolean) => void;
  height: number;
  onHeightChange: (value: number) => void;
  color: string;
  onColorChange: (value: string) => void;
  opacity: number;
  onOpacityChange: (value: number) => void;
}

export function ReadingRulerSettings({ dragMode, onDragModeChange, height, onHeightChange, color, onColorChange, opacity, onOpacityChange }: ReadingRulerSettingsProps) {
  return <div className="reading-ruler-settings-content">
    <label className="reading-ruler-mode">
      <input type="checkbox" checked={dragMode} onChange={(event) => onDragModeChange(event.target.checked)} />
      Drag to move ruler
    </label>
    <label className="reading-ruler-height">Lower shade height: {height}px
      <input type="range" min="0" max="240" step="4" value={height}
        onChange={(event) => onHeightChange(Number(event.target.value))} />
    </label>
    <label className="reading-ruler-opacity">Cover opacity: {opacity}%
      <input type="range" min="0" max="100" step="1" value={opacity}
        onChange={(event) => onOpacityChange(Number(event.target.value))} />
    </label>
    <div className="reading-ruler-palette" role="group" aria-label="Reading ruler color">
      {RULER_COLORS.map((option) => <button key={option.value} type="button"
        className="reading-ruler-swatch" style={{ backgroundColor: option.value }}
        aria-label={`${option.name} ruler`} aria-pressed={color === option.value}
        title={option.name} onClick={() => onColorChange(option.value)} />)}
    </div>
  </div>;
}
