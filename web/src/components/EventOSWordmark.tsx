import { EVENTOS_ICON, EVENTOS_ICON_REVERSED } from '../utils/brand';

interface Props {
  /** Use the reversed (light-tile) mark for dark backgrounds. */
  reversed?: boolean;
  iconSize?: number;
  /** Font size for the "EventOS" text; omit to size via CSS instead. */
  textSize?: string;
  className?: string;
}

/** Icon + live "EventOS" text — see theme.css .eventos-wordmark for the
 * shared styling. Text color follows the container; "OS" is always emerald. */
export function EventOSWordmark({ reversed, iconSize = 28, textSize, className }: Props) {
  return (
    <span className={`eventos-wordmark${className ? ` ${className}` : ''}`}>
      <img
        src={reversed ? EVENTOS_ICON_REVERSED : EVENTOS_ICON}
        alt=""
        width={iconSize}
        height={iconSize}
        className="eventos-wordmark__icon"
      />
      <span className="eventos-wordmark__text" style={textSize ? { fontSize: textSize } : undefined}>
        Event<span className="eventos-wordmark__os">OS</span>
      </span>
    </span>
  );
}
