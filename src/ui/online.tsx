// Online popups: the shared popup shell, Privacy, Get on the Wall, the Nickname card, Cloud Code entry and Settings rows.
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { cleanNickname, NICKNAME_MAX, tidyNickname } from '../../worker/nickname';
import { PRIVACY } from '../privacy';
import { Btn } from './btn';
import { WallRow } from './wall';

/** Null when the build has no Board API. `code` is the Cloud Code, null without a Device. */
export interface OnlineView {
  code: string | null;
  nickname: string | null;
  /** The Privacy popup asks for Accept (before the first online write) instead of just showing the notice. */
  askPrivacy: boolean;
}

/** Async actions resolve to null, or to the text to show inline. */
export interface OnlineActions {
  join: () => void;
  accept: () => void;
  notNow: () => void;
  showPrivacy: () => void;
  pickNickname: () => void;
  enterCode: () => void;
  back: () => void;
  saveNickname: (name: string) => Promise<string | null>;
  useCode: (code: string) => Promise<string | null>;
  rotate: () => Promise<string | null>;
  remove: () => Promise<string | null>;
  copyCode: () => Promise<boolean>;
}

type Click = { click: () => void };

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

export function PrivacyPopup({ ask, o, a }: { ask: boolean; o: OnlineActions; a: Click }) {
  return (
    <Popup
      title="🔒 Privacy"
      close={ask ? o.notNow : o.back}
      foot={
        ask && (
          <div class="row">
            <Btn actions={a} onClick={o.notNow}>
              Not now
            </Btn>
            <Btn actions={a} onClick={o.accept}>
              Accept
            </Btn>
          </div>
        )
      }
    >
      {ask && <p class="popup-lead">Before anything goes online, here's what that means.</p>}
      {PRIVACY.map((s) => (
        <section class="privacy" key={s.heading}>
          <h3>{s.heading}</h3>
          {s.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </section>
      ))}
    </Popup>
  );
}

export function JoinPopup({ o, a }: { o: OnlineActions; a: Click }) {
  const choose = (go: () => void) => () => (a.click(), go());
  return (
    <Popup title="☁️ Get on the Wall" close={o.back}>
      <p class="popup-lead">Your Nickname and times live online, so you can carry them to another browser.</p>
      <button class="choice main" onClick={choose(o.pickNickname)}>
        <span>🆕</span>
        <p>
          <b>I'm new here</b>Pick a Nickname and go
        </p>
      </button>
      <button class="choice" onClick={choose(o.enterCode)}>
        <span>🔑</span>
        <p>
          <b>I've played on another browser</b>Enter its Cloud Code
        </p>
      </button>
      <button class="choice" onClick={choose(o.back)}>
        <span>💤</span>
        <p>
          <b>Not now</b>Keep playing offline
        </p>
      </button>
      <button class="link" onClick={choose(o.showPrivacy)}>
        Privacy
      </button>
    </Popup>
  );
}

const ADJECTIVES = [
  'Sleepy',
  'Turbo',
  'Wobbly',
  'Crispy',
  'Sneaky',
  'Jolly',
  'Fuzzy',
  'Mighty',
  'Zippy',
  'Lucky',
  'Speedy',
];
const NOUNS = [
  'Stocker',
  'Cashier',
  'Melon',
  'Trolley',
  'Pickle',
  'Bagel',
  'Mop',
  'Till',
  'Egg',
  'Crate',
  'Pizza',
  'Shelf',
];
const pick = (list: string[]): string => list[Math.floor(Math.random() * list.length)];
const suggestName = (): string => `${pick(ADJECTIVES)} ${pick(NOUNS)}`;

export function NicknamePopup({ current, o, a }: { current: string | null; o: OnlineActions; a: Click }) {
  const [name, setName] = useState(() => current ?? suggestName());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const clean = cleanNickname(name);
  const save = async () => {
    if (busy) return;
    if (!clean) return setError(`3–${NICKNAME_MAX} letters, digits, space, _ or -`);
    setBusy(true);
    setError((await o.saveNickname(clean)) ?? '');
    setBusy(false);
  };
  const edit = (v: string) => (setName(v), setError(''));
  return (
    <Popup
      title="✏️ Pick a Nickname"
      close={o.back}
      foot={
        <Btn class="buy" actions={a} disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save'}
        </Btn>
      }
    >
      <p class="popup-lead">This is how you'll show on the Wall.</p>
      <WallRow rank={1} nickname={clean ?? (name.trim() || '???')} value="0:00.00" me />
      <div class="field">
        <input
          class={error ? 'bad' : ''}
          value={name}
          maxLength={NICKNAME_MAX}
          autocomplete="off"
          spellcheck={false}
          aria-label="Nickname"
          onInput={(e) => edit((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && void save()}
        />
        <button class="round" aria-label="Suggest a name" onClick={() => (a.click(), edit(suggestName()))}>
          🎲
        </button>
      </div>
      <div class={`field-help ${error ? 'bad' : ''}`}>
        <span>{error || 'No real names'}</span>
        <span>
          {tidyNickname(name).length}/{NICKNAME_MAX}
        </span>
      </div>
    </Popup>
  );
}

/** `WBLY-XXXX-…` as you type: letters and digits only, upper case, a dash every 4. */
const formatCode = (raw: string): string =>
  (
    raw
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '')
      .slice(0, 20)
      .match(/.{1,4}/g) ?? []
  ).join('-');

export function CodePopup({ o, a }: { o: OnlineActions; a: Click }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const use = async () => {
    if (busy) return;
    if (code.length < 24) return setError('A Cloud Code has 5 groups of 4');
    setBusy(true);
    setError((await o.useCode(code)) ?? '');
    setBusy(false);
  };
  return (
    <Popup
      title="🔑 Your Cloud Code"
      close={o.back}
      foot={
        <div class="row">
          <Btn actions={a} onClick={o.join}>
            Back
          </Btn>
          <Btn class="buy" actions={a} disabled={busy} onClick={() => void use()}>
            {busy ? 'Checking…' : 'Use it'}
          </Btn>
        </div>
      }
    >
      <p class="popup-lead">It's in Settings on the browser you played on.</p>
      <div class="field">
        <input
          class={`code ${error ? 'bad' : ''}`}
          value={code}
          placeholder="WBLY-XXXX-XXXX-XXXX-XXXX"
          autocomplete="off"
          spellcheck={false}
          aria-label="Cloud Code"
          onInput={(e) => {
            const input = e.target as HTMLInputElement;
            const next = formatCode(input.value);
            input.value = next;
            setCode(next);
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && void use()}
        />
      </div>
      <div class={`field-help ${error ? 'bad' : ''}`}>
        <span>{error || 'Keep it secret, like a key'}</span>
      </div>
    </Popup>
  );
}

const mask = (code: string): string => code.replace(/-[0-9A-Z]{4}(?=-)/g, '-••••');

/** Settings: Nickname, Cloud Code, New Cloud Code, Delete my Device, Privacy; or one Join row without a Device. */
export function OnlineRows({ v, o, a }: { v: OnlineView; o: OnlineActions; a: Click }) {
  const [reveal, setReveal] = useState(false);
  const [confirm, setConfirm] = useState<'rotate' | 'delete' | null>(null);
  const [note, setNote] = useState('');
  const run = async (act: () => Promise<string | null>, done: string) => {
    setConfirm(null);
    setNote((await act()) ?? done);
  };
  if (!v.code)
    return (
      <>
        <div class="online-row">
          <span>
            Wall of Fame<b>Not on it yet</b>
          </span>
          <Btn actions={a} onClick={o.join}>
            Join
          </Btn>
        </div>
        {note && <p class="online-note">{note}</p>}
      </>
    );
  return (
    <>
      <div class="online-row">
        <span>
          Nickname<b>{v.nickname}</b>
        </span>
        <Btn actions={a} onClick={o.pickNickname}>
          Change
        </Btn>
      </div>
      <div class="online-row">
        <span>
          Cloud Code<b class="code">{reveal ? v.code : mask(v.code)}</b>
        </span>
        <div>
          <Btn actions={a} onClick={() => setReveal(!reveal)}>
            {reveal ? 'Hide' : 'Show'}
          </Btn>
          <Btn actions={a} onClick={() => void o.copyCode().then((ok) => setNote(ok ? 'Copied!' : 'Copy failed'))}>
            Copy
          </Btn>
        </div>
        <small>Enter it on another browser to carry on there. Keep it secret, like a key.</small>
      </div>
      {confirm ? (
        <div class="online-row confirm">
          <small>
            {confirm === 'rotate'
              ? 'Your old Cloud Code stops working on every browser.'
              : 'Your Nickname, Wall rows, Replays and cloud save are deleted for good.'}
          </small>
          <div>
            <Btn actions={a} onClick={() => setConfirm(null)}>
              Cancel
            </Btn>
            <Btn
              class="danger"
              actions={a}
              onClick={() =>
                void (confirm === 'rotate' ? run(o.rotate, 'New Cloud Code made') : run(o.remove, 'Device deleted'))
              }
            >
              {confirm === 'rotate' ? 'New code' : 'Delete'}
            </Btn>
          </div>
        </div>
      ) : (
        <div class="row">
          <Btn actions={a} onClick={() => (setNote(''), setConfirm('rotate'))}>
            New Cloud Code
          </Btn>
          <Btn class="danger" actions={a} onClick={() => (setNote(''), setConfirm('delete'))}>
            Delete my Device
          </Btn>
        </div>
      )}
      {note && <p class="online-note">{note}</p>}
      <button class="link" onClick={() => (a.click(), o.showPrivacy())}>
        Privacy
      </button>
    </>
  );
}
