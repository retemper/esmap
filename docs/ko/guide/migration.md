# Module Federation에서 마이그레이션

`@esmap/compat`는 Webpack Module Federation에서 esmap import maps로의 마이그레이션 레이어를 제공합니다.

## 개요

현재 Module Federation을 사용 중이라면, `@esmap/compat`를 통해 MF remote entry를 import map entry로 변환하여 점진적으로 마이그레이션할 수 있습니다. 이를 통해 전환 기간 동안 두 시스템을 나란히 운영할 수 있습니다.
