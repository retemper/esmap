/**
 * Team Directory MFE — keepAlive 상태 보존 + 레이지 서브모듈 시연.
 *
 * 시연 포인트:
 * - keepAlive: 다른 라우트로 이동했다 돌아오면 검색어, 스크롤, 선택 상태 보존
 * - 레이지 서브모듈: MemberDetail을 dynamic import로 로드 (MFE 내부 코드 스플리팅)
 * - 디자인 시스템 컴포넌트 소비
 * - dual-mode 렌더링: page(기본) / sidebar(컴팩트) 모드 지원
 * - 멤버 선택 이벤트: esmap:team:member-select / esmap:team:member-deselect
 */
import { createReactMfeApp } from '@esmap/react';
import { TeamList, type TeamListProps } from './TeamList.js';

export default createReactMfeApp<TeamListProps>({
  rootComponent: TeamList,
});
