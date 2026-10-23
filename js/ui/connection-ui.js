/* ============ connection-ui.js — estado de red en cooperativo ============ */
G.ConnectionUI = (() => {
  const $ = id => document.getElementById(id);

  let open = false;
  let refreshT = 0;

  function init() {
    $('connection-close').onclick = close;
    $('connection-resume').onclick = () => {
      if (G.Coop && G.Coop.resumeRun && !G.Coop.resumeRun()) {
        G.UI.toast('Todavía no se puede reanudar. Espera a que el grupo esté listo.', 3200);
      }
    };

    $('connection-retry').onclick = () => {
      if (G.Coop && G.Coop.reconnect && !G.Coop.reconnect()) {
        G.UI.toast('No se pudo iniciar el reintento. Espera un momento y vuelve a probar.', 3200);
      }
    };

    $('connection-leave').onclick = () => {
      if (G.Coop && G.Coop.abandonReconnect) G.Coop.abandonReconnect();
    };
  }

  function openPanel() {
    open = true;
    $('connection-panel').classList.remove('hidden');
    if (!refreshT) refreshT = setInterval(render, 1000);
    render();
  }

  function close(force = false) {
    if (!force && G.Coop && G.Coop.connectionState && G.Coop.connectionState().paused) return;
    open = false;
    clearInterval(refreshT);
    refreshT = 0;
    $('connection-panel').classList.add('hidden');
  }

  function render() {
    if (!open || !G.Coop || !G.Coop.connectionState) return;

    const state = G.Coop.connectionState();
    const list = $('connection-members');

    $('connection-message').textContent = state.message || '';

    list.replaceChildren(...state.players.map(player => {
      const status = player.status === 'online' ? 'Conectado'
        : player.status === 'reconnecting' ? 'Reconectando · ' + player.left + ' s'
          : 'Desconectado';
      const ping = player.ping == null ? '— ms' : player.ping + ' ms';
      const row = document.createElement('div');
      row.className = 'connection-member';
      const dot = document.createElement('i');
      dot.className = 'connection-dot ' + player.status;
      const name = document.createElement('b');
      name.textContent = player.name;
      name.setAttribute('translate', 'no');
      const statusLabel = document.createElement('span');
      statusLabel.className = 'connection-status';
      statusLabel.textContent = status;
      const pingLabel = document.createElement('span');
      pingLabel.className = 'connection-ping';
      pingLabel.textContent = ping;
      row.append(dot, name, statusLabel, pingLabel);
      return row;
    }));

    $('connection-close').classList.toggle('hidden', state.paused);
    $('connection-actions').classList.toggle('hidden', !state.paused || (!state.host && !state.hostDisconnected));
    $('connection-retry').classList.toggle('hidden', state.host || !state.hostDisconnected);
    $('connection-leave').classList.toggle('hidden', state.host || !state.hostDisconnected);
    $('connection-resume').classList.toggle('hidden', !state.host);
    $('connection-resume').disabled = !state.canResume;
    $('connection-resume').textContent = state.syncing ? 'Sincronizando…'
      : state.canResume ? 'Reanudar partida' : 'Esperando al grupo…';
    const countdown = $('connection-countdown');
    countdown.classList.toggle('hidden', !state.countdown);
    countdown.textContent = state.countdown ? 'La partida comienza en ' + state.countdown + '…' : '';
  }

  function isOpen() {
    return open;
  }

  return { init, open: openPanel, close, render, isOpen };
})();