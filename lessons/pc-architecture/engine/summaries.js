/* Result summaries for the PC architecture tasks. Load after task-runtime.js and the game scripts. */
(function () {
  'use strict';
  const R = window.TaskRuntime;
  if (!R) return;
  const { h } = R;
  const count = o => Object.keys(o || {}).filter(k => o[k]).length;

  const stats = rows => h('dl', { class: 'res-stats' },
    rows.filter(Boolean).map(([k, v]) => h('div', null, h('dt', { text: k }), h('dd', { text: String(v) }))));
  const review = (title, list) => (list && list.length) ? h('div', { class: 'res-block' },
    h('h3', { text: title }),
    h('ul', { class: 'res-list' }, list.map(r => h('li', { class: r.right ? 'ok' : 'bad' },
      h('span', { class: 'res-ic', 'aria-hidden': 'true', text: r.right ? '✓' : '✗' }),
      h('span', { text: r.text }))))) : null;

  /* photo / complaint quizzes */
  const quiz = d => stats([['Відповідей дано', count(d.ans)]]);
  R.summaries['pc-types'] = quiz;
  R.summaries['pc-doctor'] = quiz;

  R.summaries['pc-build'] = d => stats([
    ['Встановлено деталей', (d.installed || []).length],
    ['Помилкових спроб', d.mistakes ?? 0],
    ['Спроб увімкнути', d.attempts ?? 0]]);

  /* question lists and the CPU passport keep a ready review */
  const withReview = (title) => d => h('div', null,
    d.review ? stats([['Правильно', `${d.review.filter(r => r.right).length} з ${d.review.length}`]]) : null,
    review(title, d.review));
  R.summaries['mb-detective'] = withReview('Твої відповіді');
  R.summaries['cpu-fit'] = withReview('Твої відповіді');
  R.summaries['cpu-passport'] = withReview('Паспорт процесора');

  /* mission simulators */
  const missions = d => stats([
    ['Розв’язано місій', count(d.solved)],
    ['З першої спроби', count(d.first)]]);
  R.summaries['ram-sim'] = missions;
  R.summaries['ram-config'] = missions;
  R.summaries['storage-race'] = missions;

  /* memory passport of the learner's own PC (no score) */
  R.summaries['pc-passport'] = d => {
    const v = d.v || {};
    const rows = [
      ['Робоче місце', v.station],
      ['Обсяг RAM', v.ramGb && v.ramGb + ' ГБ'],
      ['Швидкість RAM', v.ramSpeed && v.ramSpeed + ' ' + (v.ramUnit || '')],
      ['Зайнято гнізд', v.slotsUsed && (v.slotsUsed + (v.slotsTotal ? ' з ' + v.slotsTotal : ''))],
      ['Форм-фактор', v.form],
      ['Накопичувач', [v.diskType, v.diskModel].filter(Boolean).join(' · ')],
      ['Обсяг диска', v.diskGb && v.diskGb + ' ГБ'],
      ['Читання / запис', v.noBench ? 'не вимірювали' : (v.read && v.write ? `${v.read} / ${v.write} МБ/с` : '')]
    ].filter(r => r[1]);
    return h('div', null, stats(rows),
      v.conclusion ? h('div', { class: 'res-block' }, h('h3', { text: 'Мій висновок' }), h('p', { text: v.conclusion })) : null);
  };

  /* passports of the motherboard and the graphics card */
  R.summaries['hw-passport'] = d => stats([['Заповнено полів', Object.keys(d.v || {}).filter(k => String(d.v[k] || '').trim()).length]]);

  R.summaries['mb-quiz'] = d => stats([['Відповідей дано', Object.keys(d.ans || {}).length]]);

  R.summaries['pc-config'] = d => stats([
    ['Виконано замовлень', `${count(d.done)} з 3`],
    ['Перевірок', Object.values(d.tries || {}).reduce((a, b) => a + (Number(b) || 0), 0)]]);
})();
