// The one popup shell.
import type { ComponentChildren } from 'preact';

/** Every popup: title + ✕, a scrolling body, an optional footer. Only ✕ or a button closes it. */
export function Popup(props: {
  title: string;
  close: () => void;
  children: ComponentChildren;
  foot?: ComponentChildren;
}) {
  return (
    <div class="panel popup" onPointerDown={(e) => e.stopPropagation()}>
      <header>
        <h2>{props.title}</h2>
        <button class="popup-x" aria-label="Close" onClick={props.close}>
          ✕
        </button>
      </header>
      <div class="popup-body">{props.children}</div>
      {props.foot && <footer>{props.foot}</footer>}
    </div>
  );
}
