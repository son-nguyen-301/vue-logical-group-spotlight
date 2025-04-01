// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

interface LogicalGroup {
	startLine: number;
	endLine: number;
	name: string;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let activeEditor = vscode.window.activeTextEditor;
	let decorationType: vscode.TextEditorDecorationType | undefined;

	// Create decoration type for spotlight
	const createDecorationType = () => {
		return vscode.window.createTextEditorDecorationType({
			backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
			isWholeLine: true,
		});
	};

	// Find logical groups in the current document
	const findLogicalGroups = (document: vscode.TextDocument): LogicalGroup[] => {
		const groups: LogicalGroup[] = [];
		const text = document.getText();
		const lines = text.split('\n');

		let currentGroup: LogicalGroup | null = null;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const match = line.match(/\/\/\s*LOGICAL GROUP:\s*(.+)/);

			if (match) {
				// If we have a previous group, close it
				if (currentGroup) {
					currentGroup.endLine = i - 1;
					groups.push(currentGroup);
				}

				// Start a new group
				currentGroup = {
					startLine: i + 1,
					endLine: i + 1,
					name: match[1].trim()
				};
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

		const groups = findLogicalGroups(activeEditor.document);
		const decorations: vscode.DecorationOptions[] = [];

		groups.forEach(group => {
			const range = new vscode.Range(
				new vscode.Position(group.startLine, 0),
				new vscode.Position(group.endLine, 0)
			);
			decorations.push({ range });
		});

		if (decorationType) {
			decorationType.dispose();
		}
		decorationType = createDecorationType();
		activeEditor.setDecorations(decorationType, decorations);
	};

	// Register the toggle spotlight command
	const disposable = vscode.commands.registerCommand('vue-logical-group-spotlight.toggleSpotlight', () => {
		if (decorationType) {
			decorationType.dispose();
			decorationType = undefined;
		} else {
			updateDecorations();
		}
	});

	// Update decorations when the active editor changes
	const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		if (decorationType) {
			updateDecorations();
		}
	});

	// Update decorations when the document changes
	const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document && decorationType) {
			updateDecorations();
		}
	});

	context.subscriptions.push(disposable, editorChangeDisposable, documentChangeDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
