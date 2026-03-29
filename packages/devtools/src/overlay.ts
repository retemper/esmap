/** 오버레이에 표시할 앱 정보 */
export interface OverlayAppInfo {
  readonly name: string;
  readonly status: string;
  readonly container: string;
  readonly perfDuration?: number;
}

/** 오버레이 설정 */
export interface OverlayOptions {
  /** 오버레이 토글 키보드 단축키. 기본값 'Alt+Shift+D'. */
  readonly triggerKey?: string;
  /** 초기 위치. 기본값 'bottom-right'. */
  readonly position?:
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right';
}

/** 오버레이 제어 핸들 */
export interface DevtoolsOverlay {
  /** 오버레이를 표시한다 */
  show(): void;
  /** 오버레이를 숨긴다 */
  hide(): void;
  /** 표시/숨김을 토글한다 */
  toggle(): void;
  /** 앱 정보를 업데이트한다 */
  update(apps: readonly OverlayAppInfo[]): void;
  /** 오버레이와 이벤트 리스너를 제거한다 */
  destroy(): void;
  /** 현재 표시 여부 */
  readonly visible: boolean;
}

/** 오버레이 패널의 기본 스타일 */
const OVERLAY_STYLES = {
  position: 'fixed',
  zIndex: '999999',
  background: '#1a1a2e',
  color: '#e0e0e0',
  borderRadius: '8px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  fontFamily: 'monospace',
  fontSize: '12px',
  padding: '12px',
  maxHeight: '400px',
  width: '360px',
  overflow: 'auto',
} as const;

/** 앱 상태별 배지 색상 매핑 */
const STATUS_COLORS: Record<string, string> = {
  MOUNTED: '#4caf50',
  NOT_LOADED: '#9e9e9e',
  LOADING: '#2196f3',
  BOOTSTRAPPING: '#2196f3',
  NOT_MOUNTED: '#ff9800',
  LOAD_ERROR: '#f44336',
  UNMOUNTING: '#ff9800',
};

/** 파싱된 키보드 단축키 조합 */
interface ParsedKeyCombo {
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly key: string;
}

/**
 * "Alt+Shift+D" 형식의 단축키 문자열을 KeyboardEvent 비교용 객체로 변환한다.
 * @param combo - 파싱할 단축키 문자열
 */
function parseKeyCombo(combo: string): ParsedKeyCombo {
  const parts = combo.split('+').map((p) => p.trim().toLowerCase());
  const key = parts[parts.length - 1] ?? '';

  return {
    altKey: parts.includes('alt'),
    ctrlKey: parts.includes('ctrl'),
    shiftKey: parts.includes('shift'),
    metaKey: parts.includes('meta'),
    key,
  };
}

/**
 * KeyboardEvent가 파싱된 단축키 조합과 일치하는지 확인한다.
 * @param event - 비교할 키보드 이벤트
 * @param combo - 파싱된 단축키 조합
 */
function matchesKeyCombo(event: KeyboardEvent, combo: ParsedKeyCombo): boolean {
  return (
    event.altKey === combo.altKey &&
    event.ctrlKey === combo.ctrlKey &&
    event.shiftKey === combo.shiftKey &&
    event.metaKey === combo.metaKey &&
    event.key.toLowerCase() === combo.key
  );
}

/** 오버레이 위치를 CSS 속성으로 반환한다. */
type PositionKey = 'top' | 'bottom' | 'left' | 'right';

/**
 * 위치 문자열을 CSS 스타일 속성 객체로 변환한다.
 * @param position - 오버레이 위치
 */
function getPositionStyles(
  position: NonNullable<OverlayOptions['position']>,
): Record<PositionKey, string> {
  const styles: Record<PositionKey, string> = {
    top: '',
    bottom: '',
    left: '',
    right: '',
  };

  switch (position) {
    case 'top-left': {
      styles.top = '16px';
      styles.left = '16px';
      break;
    }
    case 'top-right': {
      styles.top = '16px';
      styles.right = '16px';
      break;
    }
    case 'bottom-left': {
      styles.bottom = '16px';
      styles.left = '16px';
      break;
    }
    case 'bottom-right': {
      styles.bottom = '16px';
      styles.right = '16px';
      break;
    }
  }

  return styles;
}

/**
 * 오버레이의 헤더 영역을 생성한다.
 * @param onClose - 닫기 버튼 클릭 시 호출할 콜백
 */
function createHeader(onClose: () => void): HTMLElement {
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '8px';
  header.style.paddingBottom = '8px';
  header.style.borderBottom = '1px solid #333';

  const title = document.createElement('span');
  title.textContent = 'esmap devtools';
  title.style.fontWeight = 'bold';
  title.style.fontSize = '13px';
  title.style.color = '#ffffff';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '\u00d7';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.color = '#999';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '18px';
  closeBtn.style.padding = '0';
  closeBtn.style.lineHeight = '1';
  closeBtn.addEventListener('click', onClose);

  header.appendChild(title);
  header.appendChild(closeBtn);

  return header;
}

/**
 * 앱 목록 테이블의 헤더 행을 생성한다.
 * @param thead - 테이블 헤더 요소
 */
function createTableHeader(thead: HTMLTableSectionElement): void {
  const headerRow = document.createElement('tr');
  const columns = ['Name', 'Status', 'Container', 'Duration'];

  for (const col of columns) {
    const th = document.createElement('th');
    th.textContent = col;
    th.style.textAlign = 'left';
    th.style.padding = '4px 8px';
    th.style.color = '#888';
    th.style.fontWeight = 'normal';
    th.style.borderBottom = '1px solid #333';
    headerRow.appendChild(th);
  }

  thead.appendChild(headerRow);
}

/**
 * 앱 테이블 요소를 생성하고 thead/tbody를 반환한다.
 */
function createAppTable(): { table: HTMLTableElement; tbody: HTMLTableSectionElement } {
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';

  const thead = document.createElement('thead');
  createTableHeader(thead);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  return { table, tbody };
}

/**
 * 상태 배지 요소를 생성한다.
 * @param status - 앱 상태 문자열
 */
function createStatusBadge(status: string): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.style.display = 'inline-block';
  badge.style.width = '8px';
  badge.style.height = '8px';
  badge.style.borderRadius = '50%';
  badge.style.marginRight = '4px';
  const color = STATUS_COLORS[status] ?? '#666';
  badge.style.backgroundColor = color;
  badge.setAttribute('data-color', color);
  return badge;
}

/**
 * 앱 정보를 표시하는 테이블 행을 생성한다.
 * @param app - 표시할 앱 정보
 */
function createAppRow(app: OverlayAppInfo): HTMLTableRowElement {
  const row = document.createElement('tr');

  const nameCell = document.createElement('td');
  nameCell.textContent = app.name;
  nameCell.style.padding = '4px 8px';

  const statusCell = document.createElement('td');
  statusCell.style.padding = '4px 8px';
  const badge = createStatusBadge(app.status);
  const statusText = document.createElement('span');
  statusText.textContent = app.status;
  statusCell.appendChild(badge);
  statusCell.appendChild(statusText);

  const containerCell = document.createElement('td');
  containerCell.textContent = app.container;
  containerCell.style.padding = '4px 8px';
  containerCell.style.color = '#aaa';

  const durationCell = document.createElement('td');
  durationCell.textContent =
    app.perfDuration !== undefined ? `${app.perfDuration}ms` : '-';
  durationCell.style.padding = '4px 8px';
  durationCell.style.color = '#aaa';

  row.appendChild(nameCell);
  row.appendChild(statusCell);
  row.appendChild(containerCell);
  row.appendChild(durationCell);

  return row;
}

/**
 * 루트 컨테이너에 스타일과 위치를 적용한다.
 * @param root - 오버레이 루트 요소
 * @param position - 오버레이 위치
 */
function applyRootStyles(
  root: HTMLDivElement,
  position: NonNullable<OverlayOptions['position']>,
): void {
  const entries = Object.entries(OVERLAY_STYLES) as ReadonlyArray<
    [keyof typeof OVERLAY_STYLES, string]
  >;
  for (const [key, value] of entries) {
    root.style[key] = value;
  }

  const posStyles = getPositionStyles(position);
  const posEntries = Object.entries(posStyles) as ReadonlyArray<
    [PositionKey, string]
  >;
  for (const [key, value] of posEntries) {
    root.style[key] = value;
  }
}

/**
 * DevTools 오버레이를 생성한다.
 * 브라우저 화면에 고정 패널을 추가하여 앱 상태를 시각적으로 확인할 수 있다.
 * @param options - 오버레이 설정
 */
export function createDevtoolsOverlay(options?: OverlayOptions): DevtoolsOverlay {
  const triggerKey = options?.triggerKey ?? 'Alt+Shift+D';
  const position = options?.position ?? 'bottom-right';

  const root = document.createElement('div');
  root.setAttribute('data-esmap-devtools', 'overlay');
  applyRootStyles(root, position);

  const ref = { visible: false };

  /** 오버레이를 숨긴다 */
  function hide(): void {
    root.style.display = 'none';
    ref.visible = false;
  }

  /** 오버레이를 표시한다 */
  function show(): void {
    root.style.display = 'block';
    ref.visible = true;
  }

  /** 표시/숨김을 토글한다 */
  function toggle(): void {
    if (ref.visible) {
      hide();
    } else {
      show();
    }
  }

  const header = createHeader(hide);
  root.appendChild(header);

  const { table, tbody } = createAppTable();
  root.appendChild(table);

  root.style.display = 'none';
  document.body.appendChild(root);

  const parsed = parseKeyCombo(triggerKey);

  /** 키보드 단축키로 오버레이를 토글하는 이벤트 핸들러 */
  const onKeyDown = (e: KeyboardEvent): void => {
    if (matchesKeyCombo(e, parsed)) {
      toggle();
    }
  };
  document.addEventListener('keydown', onKeyDown);

  /**
   * 앱 정보 목록을 업데이트한다.
   * @param apps - 표시할 앱 정보 배열
   */
  function update(apps: readonly OverlayAppInfo[]): void {
    while (tbody.firstChild) {
      tbody.removeChild(tbody.firstChild);
    }
    for (const app of apps) {
      const row = createAppRow(app);
      tbody.appendChild(row);
    }
  }

  /** 오버레이와 이벤트 리스너를 제거한다 */
  function destroy(): void {
    document.removeEventListener('keydown', onKeyDown);
    root.remove();
  }

  return {
    show,
    hide,
    toggle,
    update,
    destroy,
    get visible() {
      return ref.visible;
    },
  };
}
