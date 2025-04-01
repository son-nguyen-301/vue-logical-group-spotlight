// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

interface LogicalGroup {
	startLine: number;
	endLine: number;
	name: string;
	color: string;
}

// Predefined colors that work well in both light and dark themes
const GROUP_COLORS = [
	'rgba(255, 182, 193, 0.2)',  // Light pink
	'rgba(144, 238, 144, 0.2)',  // Light green
	'rgba(173, 216, 230, 0.2)',  // Light blue
	'rgba(255, 218, 185, 0.2)',  // Peach
	'rgba(221, 160, 221, 0.2)',  // Plum
	'rgba(176, 196, 222, 0.2)',  // Steel blue
	'rgba(255, 255, 224, 0.2)',  // Light yellow
	'rgba(176, 224, 230, 0.2)',  // Powder blue
];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let activeEditor = vscode.window.activeTextEditor;
	let decorationTypes: vscode.TextEditorDecorationType[] = [];

	// Create decoration type for spotlight with specific color
	const createDecorationType = (color: string) => {
		return vscode.window.createTextEditorDecorationType({
			backgroundColor: color,
			isWholeLine: true,
			overviewRulerColor: color,
			overviewRulerLane: vscode.OverviewRulerLane.Full
		});
	};

	// Find logical groups in the current document
	const findLogicalGroups = (document: vscode.TextDocument): LogicalGroup[] => {
		const groups: LogicalGroup[] = [];
		const text = document.getText();
		const lines = text.split('\n');

		let currentGroup: LogicalGroup | null = null;
		let colorIndex = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const match = line.match(/\/\/\s*LOGICAL GROUP:\s*(.+)/);

			if (match) {
				// If we have a previous group, close it
				if (currentGroup) {
					currentGroup.endLine = i - 1;
					groups.push(currentGroup);
				}

				// Start a new group with a color
				currentGroup = {
					startLine: i + 1,
					endLine: i + 1,
					name: match[1].trim(),
					color: GROUP_COLORS[colorIndex % GROUP_COLORS.length]
				};
				colorIndex++;
			}
		}

		// Close the last group if exists
		if (currentGroup) {
			currentGroup.endLine = lines.length - 1;
			groups.push(currentGroup);
		}

		return groups;
	};

	// Update decorations for the current editor
	const updateDecorations = () => {
		if (!activeEditor) {
			return;
		}

		// Dispose of existing decorations
		decorationTypes.forEach(type => type.dispose());
		decorationTypes = [];

		const groups = findLogicalGroups(activeEditor.document);
		
		groups.forEach(group => {
			const decorationType = createDecorationType(group.color);
			const range = new vscode.Range(
				new vscode.Position(group.startLine, 0),
				new vscode.Position(group.endLine, 0)
			);
			activeEditor!.setDecorations(decorationType, [{ range }]);
			decorationTypes.push(decorationType);
		});
	};

	// Register the toggle spotlight command
	const disposable = vscode.commands.registerCommand('vue-logical-group-spotlight.toggleSpotlight', () => {
		if (decorationTypes.length > 0) {
			decorationTypes.forEach(type => type.dispose());
			decorationTypes = [];
		} else {
			updateDecorations();
		}
	});

	// Update decorations when the active editor changes
	const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		if (decorationTypes.length > 0) {
			updateDecorations();
		}
	});

	// Update decorations when the document changes
	const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document && decorationTypes.length > 0) {
			updateDecorations();
		}
	});

	context.subscriptions.push(disposable, editorChangeDisposable, documentChangeDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
