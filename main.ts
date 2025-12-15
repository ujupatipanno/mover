import { App, Notice, Plugin, PluginSettingTab, Setting, TFolder, TFile, FuzzySuggestModal } from 'obsidian';

// 명령어 정보 인터페이스
interface CommandInfo {
	id: string;        // 명령어 ID
	folder: string;    // 대상 폴더 경로
}

// 플러그인 설정 인터페이스
interface FileMoverSettings {
	commands: CommandInfo[];      // 등록된 명령어 목록
	showNotification: boolean;    // 이동 완료 알림 표시 여부
}

// 기본 설정값
const DEFAULT_SETTINGS: FileMoverSettings = {
	commands: [],
	showNotification: true
}

// 폴더 선택 모달
class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	onChooseFolder: (folder: TFolder) => void;

	constructor(app: App, onChooseFolder: (folder: TFolder) => void) {
		super(app);
		this.onChooseFolder = onChooseFolder;
	}

	// 모든 폴더 목록 가져오기
	getItems(): TFolder[] {
		const folders: TFolder[] = [];
		this.app.vault.getAllLoadedFiles().forEach(file => {
			if (file instanceof TFolder) {
				folders.push(file);
			}
		});
		return folders;
	}

	// 폴더 이름 표시
	getItemText(folder: TFolder): string {
		return folder.path;
	}

	// 폴더 선택 시 콜백 실행
	onChooseItem(folder: TFolder, evt: MouseEvent | KeyboardEvent): void {
		this.onChooseFolder(folder);
	}
}

export default class FileMoverPlugin extends Plugin {
	settings: FileMoverSettings;

	async onload() {
		await this.loadSettings();

		// 저장된 명령어들을 등록
		this.settings.commands.forEach(cmd => {
			this.registerCommand(cmd);
		});

		// 설정 탭 추가
		this.addSettingTab(new FileMoverSettingTab(this.app, this));
	}

	onunload() {
		// 플러그인 언로드 시 정리 작업
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// 명령어 등록
	registerCommand(cmd: CommandInfo) {
		this.addCommand({
			id: cmd.id,
			name: `현재 파일을 ${cmd.id}로 이동`,
			callback: async () => {
				await this.moveCurrentFile(cmd.folder, cmd.id);
			}
		});
	}

	// 명령어 추가
	async addNewCommand(id: string, folder: string) {
		// 중복 ID 체크
		if (this.settings.commands.some(cmd => cmd.id === id)) {
			new Notice('이미 존재하는 명령어 ID입니다.');
			return false;
		}

		const newCommand: CommandInfo = { id, folder };
		this.settings.commands.push(newCommand);
		await this.saveSettings();

		// 명령어 등록
		this.registerCommand(newCommand);
		return true;
	}

	// 명령어 삭제
	async removeCommand(id: string) {
		this.settings.commands = this.settings.commands.filter(cmd => cmd.id !== id);
		await this.saveSettings();

		// Obsidian은 명령어를 동적으로 제거하는 API가 없으므로
		// 플러그인을 다시 로드해야 완전히 제거됨
		// 설정에서만 제거하고 실제 명령어는 플러그인 재시작 시 제거됨
	}

	// 현재 파일을 지정된 폴더로 이동
	async moveCurrentFile(targetFolderPath: string, commandId: string) {
		const activeFile = this.app.workspace.getActiveFile();
		
		if (!activeFile) {
			new Notice('열려있는 파일이 없습니다.');
			return;
		}

		// 대상 폴더가 존재하는지 확인
		const targetFolder = this.app.vault.getAbstractFileByPath(targetFolderPath);
		if (!(targetFolder instanceof TFolder)) {
			new Notice(`대상 폴더를 찾을 수 없습니다: ${targetFolderPath}`);
			return;
		}

		try {
			// 새 경로 생성
			const newPath = `${targetFolderPath}/${activeFile.name}`;
			
			// 파일 이동
			await this.app.fileManager.renameFile(activeFile, newPath);
			
			// 알림 표시 (설정에 따라)
			if (this.settings.showNotification) {
				new Notice(`${activeFile.name} 파일이 ${commandId}로 이동되었습니다.`);
			}
		} catch (error) {
			new Notice(`파일 이동 중 오류가 발생했습니다: ${error.message}`);
		}
	}
}

// 설정 탭
class FileMoverSettingTab extends PluginSettingTab {
	plugin: FileMoverPlugin;

	constructor(app: App, plugin: FileMoverPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// 제목
		containerEl.createEl('h2', { text: '파일 이동 플러그인 설정' });

		// 알림 표시 설정
		new Setting(containerEl)
			.setName('이동 완료 알림 표시')
			.setDesc('파일 이동이 완료되면 알림을 표시합니다.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showNotification)
				.onChange(async (value) => {
					this.plugin.settings.showNotification = value;
					await this.plugin.saveSettings();
				}));

		// 구분선
		containerEl.createEl('h3', { text: '명령어 관리' });

		// 명령어 추가 버튼
		new Setting(containerEl)
			.setName('새 명령어 추가')
			.setDesc('폴더를 선택하여 새로운 이동 명령어를 추가합니다.')
			.addButton(button => button
				.setButtonText('명령어 추가')
				.setCta()
				.onClick(() => {
					this.showAddCommandModal();
				}));

		// 등록된 명령어 목록
		if (this.plugin.settings.commands.length > 0) {
			containerEl.createEl('h4', { text: '등록된 명령어 목록' });

			this.plugin.settings.commands.forEach(cmd => {
				new Setting(containerEl)
					.setName(cmd.id)
					.setDesc(`대상 폴더: ${cmd.folder}`)
					.addButton(button => button
						.setButtonText('삭제')
						.setWarning()
						.onClick(async () => {
							await this.plugin.removeCommand(cmd.id);
							new Notice('명령어가 삭제되었습니다. 플러그인을 다시 로드하면 완전히 제거됩니다.');
							this.display(); // 설정 화면 새로고침
						}));
			});
		} else {
			containerEl.createEl('p', { 
				text: '등록된 명령어가 없습니다.',
				cls: 'setting-item-description'
			});
		}
	}

	// 명령어 추가 모달 표시
	showAddCommandModal() {
		const modal = new AddCommandModal(this.app, async (id: string, folder: string) => {
			const success = await this.plugin.addNewCommand(id, folder);
			if (success) {
				new Notice('명령어가 추가되었습니다.');
				this.display(); // 설정 화면 새로고침
			}
		});
		modal.open();
	}
}

// 명령어 추가 모달
class AddCommandModal extends FuzzySuggestModal<TFolder> {
	onSubmit: (id: string, folder: string) => void;
	commandId: string = '';

	constructor(app: App, onSubmit: (id: string, folder: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
		this.setPlaceholder('폴더를 선택하세요');
	}

	// 모달이 열릴 때 먼저 ID 입력받기
	onOpen() {
		super.onOpen();
		
		// ID 입력 받기
		const inputContainer = this.modalEl.createDiv();
		inputContainer.style.padding = '10px';
		inputContainer.style.borderBottom = '1px solid var(--background-modifier-border)';
		
		const label = inputContainer.createEl('label', { 
			text: '명령어 ID를 입력하세요',
			cls: 'setting-item-name'
		});
		label.style.display = 'block';
		label.style.marginBottom = '5px';
		
		const desc = inputContainer.createEl('div', {
			text: '알파벳과 하이픈(-)을 사용하여 띄어쓰기 없이 간단하게 지으세요.',
			cls: 'setting-item-description'
		});
		desc.style.marginBottom = '10px';
		
		const input = inputContainer.createEl('input', {
			type: 'text',
			placeholder: 'move-to-archive',
			cls: 'setting-item-control'
		});
		input.style.width = '100%';
		
		input.addEventListener('input', (e) => {
			this.commandId = (e.target as HTMLInputElement).value;
		});

		// 첫 번째 요소로 삽입
		this.modalEl.insertBefore(inputContainer, this.modalEl.firstChild);
	}

	// 모든 폴더 목록 가져오기
	getItems(): TFolder[] {
		const folders: TFolder[] = [];
		this.app.vault.getAllLoadedFiles().forEach(file => {
			if (file instanceof TFolder) {
				folders.push(file);
			}
		});
		return folders;
	}

	// 폴더 이름 표시
	getItemText(folder: TFolder): string {
		return folder.path;
	}

	// 폴더 선택 시
	onChooseItem(folder: TFolder, evt: MouseEvent | KeyboardEvent): void {
		if (!this.commandId || this.commandId.trim() === '') {
			new Notice('명령어 ID를 입력해주세요.');
			return;
		}

		// ID 유효성 검사 (알파벳, 숫자, 하이픈만 허용)
		if (!/^[a-zA-Z0-9-]+$/.test(this.commandId)) {
			new Notice('명령어 ID는 알파벳, 숫자, 하이픈(-)만 사용할 수 있습니다.');
			return;
		}

		this.onSubmit(this.commandId, folder.path);
	}
}
