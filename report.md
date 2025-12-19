# 아이콘 미표시 문제 분석 보고서

## 📋 문제 상황
`registerCommand` 함수에 `icon: 'lucide-folder-input'`을 추가했으나 아이콘이 제대로 표시되지 않는 문제

## 🔍 코드 분석

### 현재 구현 (83-91번째 줄)
```typescript
registerCommand(cmd: CommandInfo) {
    this.addCommand({
        id: cmd.id,
        name: `현재 파일을 ${cmd.id}로 이동`,
        icon: 'lucide-folder-input',
        callback: async () => {
            await this.moveCurrentFile(cmd.folder, cmd.id);
        }
    });
}
```

## ❌ 주요 문제점

### 1. **잘못된 아이콘 ID 형식**
- **문제**: `'lucide-folder-input'` 형식으로 아이콘을 지정함
- **원인**: Obsidian API에서는 아이콘 ID를 지정할 때 `'lucide-'` 접두사를 **제거**하고 사용해야 함
- **예시**:
  - ❌ 잘못된 형식: `icon: 'lucide-folder-input'`
  - ✅ 올바른 형식: `icon: 'folder-input'`

### 2. **존재하지 않는 아이콘 이름**
- **문제**: `'folder-input'` 아이콘이 Lucide Icons 라이브러리에 **실제로 존재하지 않을 가능성**
- **확인 필요**: Lucide Icons 공식 목록에서 `folder-input` 아이콘의 실제 존재 여부 확인

### 3. **사용 가능한 대체 폴더 아이콘**
Lucide Icons에서 실제로 존재하는 폴더 관련 아이콘들:
- `folder` - 기본 폴더
- `folder-open` - 열린 폴더
- `folder-plus` - 폴더 추가
- `folder-minus` - 폴더 삭제
- `folder-archive` - 아카이브 폴더
- `folder-input` - ❓ **존재 여부 불확실**
- `folder-output` - ❓ **존재 여부 불확실**
- `folder-symlink` - 심볼릭 링크 폴더
- `folder-tree` - 폴더 트리
- `move` - 이동 아이콘 (파일 이동에 더 적합할 수 있음)
- `file-input` - 파일 입력 (존재 가능)
- `arrow-right-to-line` - 이동 화살표

## ✅ 해결 방안

### 방안 1: 확실하게 존재하는 아이콘 사용
```typescript
registerCommand(cmd: CommandInfo) {
    this.addCommand({
        id: cmd.id,
        name: `현재 파일을 ${cmd.id}로 이동`,
        icon: 'folder-open',  // 또는 'move', 'folder-plus' 등
        callback: async () => {
            await this.moveCurrentFile(cmd.folder, cmd.id);
        }
    });
}
```

### 방안 2: 파일 이동에 더 적합한 아이콘 사용
```typescript
icon: 'move'  // 이동을 나타내는 아이콘
```

### 방안 3: 아이콘 동작 확인 후 선택
다음 아이콘들을 순차적으로 테스트해보기:
1. `'folder-open'` - 가장 안전한 선택
2. `'move'` - 의미상 가장 적합
3. `'folder-input'` (접두사 제거) - 원래 의도한 아이콘
4. `'file-input'` - 파일 입력

## 🔧 권장 수정 사항

### 즉시 적용 가능한 수정
```typescript
// 명령어 등록
registerCommand(cmd: CommandInfo) {
    this.addCommand({
        id: cmd.id,
        name: `현재 파일을 ${cmd.id}로 이동`,
        icon: 'folder-open',  // lucide- 접두사 제거, 확실히 존재하는 아이콘 사용
        callback: async () => {
            await this.moveCurrentFile(cmd.folder, cmd.id);
        }
    });
}
```

## 📱 모바일 툴바 표시 조건

아이콘이 있어도 모바일 툴바에 표시되지 않을 수 있는 경우:
1. ✅ **아이콘 지정 완료** - `icon` 속성 추가됨
2. ❓ **모바일에서 명령어 활성화** - 특별한 모바일 전용 설정이 필요할 수 있음
3. ❓ **Obsidian 버전** - 모바일 툴바 기능이 지원되는 버전인지 확인 필요

## 🎯 다음 단계

1. **아이콘 ID 수정**: `'lucide-folder-input'` → `'folder-open'` 또는 `'move'`
2. **플러그인 빌드**: 수정 후 다시 빌드
3. **테스트**: 데스크톱과 모바일에서 아이콘 표시 확인
4. **필요시 아이콘 변경**: 다른 아이콘으로 교체 테스트

## 💡 추가 고려사항

모바일 툴바에서 명령어를 표시하려면:
- 아이콘이 **필수**
- 명령어가 현재 컨텍스트에서 **실행 가능**해야 함
- Obsidian 모바일 앱의 설정에서 **명령어 팔레트가 활성화**되어 있어야 함
