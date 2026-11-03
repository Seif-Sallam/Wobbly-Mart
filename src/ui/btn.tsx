// The game's button: stops the tap reaching the world and plays the click.
import type { ComponentChildren } from 'preact';

export function Btn(props: {
  class?: string;
  onClick: () => void;
  disabled?: boolean;
  children: ComponentChildren;
  actions: { click: () => void };
}) {
  return (
    <button
      class={`btn ${props.class ?? ''}`}
      disabled={props.disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => {
        props.actions.click();
        props.onClick();
      }}
    >
      {props.children}
    </button>
  );
}
