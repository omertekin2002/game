// The completion tracker's chips (pause menu and map card): icon + found/total per row of js/completion.js, then the
// overall percentage. A full row gets a ✓ badge and the finished tally a ★, so "complete" never rests on colour alone.
import { completion, COMPLETION_ROWS } from '../completion.js';
import { iconHtml } from './icons.js';
import { esc } from './keys.js';

/** inner HTML of a `.track` row for world W and save S */
export function trackerHtml(W, S) {
  const c = completion(W, S);
  const chips = COMPLETION_ROWS.map((r) => {
    const v = c[r.k], label = `${r.name}: ${v.found} of ${v.total}${v.full ? ', complete' : ''}`;
    return `<span class="tchip${v.full ? ' full' : ''}" data-k="${r.k}" role="img" title="${esc(label)}" aria-label="${esc(label)}">`
      + `${iconHtml(r.icon, r.fb, 'tico')}<b>${v.found}/${v.total}</b>${v.full ? '<i class="tok" aria-hidden="true">✓</i>' : ''}</span>`;
  });
  const all = `Completion: ${c.pct}%${c.done ? ', everything found' : ''}`;
  chips.push(`<span class="tchip tpct${c.done ? ' full' : ''}" data-k="pct" role="img" title="${esc(all)}" aria-label="${esc(all)}">`
    + `<b>${c.done ? '★ ' : ''}${c.pct}%</b></span>`);
  return chips.join('');
}
