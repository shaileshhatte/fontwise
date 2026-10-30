/*
  welcome.js — first-run page.
*/

'use strict';

(async () => {
  const ext = globalThis.browser ?? globalThis.chrome;
  const FW = globalThis.Fontwise;

  FW.localize();
  document.getElementById('btn-options').addEventListener('click', () => ext.runtime.openOptionsPage());

  const commands = (await ext.commands?.getAll?.()) ?? [];
  document.getElementById('shortcut-list').replaceChildren(
    ...commands.filter((command) => command.shortcut).map((command) => {
      const row = document.createElement('div');
      row.className = 'shortcut';
      const dt = document.createElement('dt');
      dt.textContent = FW.commandLabel(command);
      const dd = document.createElement('dd');
      const kbd = document.createElement('kbd');
      kbd.textContent = command.shortcut;
      dd.append(kbd);
      row.append(dt, dd);
      return row;
    }),
  );
})();
