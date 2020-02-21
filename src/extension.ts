// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

class XRefEntry {
	public offset: number;
	public objectNumber: number;

	constructor(offset: number, objectNumber: number) {
		this.offset = offset;
		this.objectNumber = objectNumber;
	}
}

function ParseXrefLine(text: String) : XRefEntry {
	let words = text.split(" ");
	return new XRefEntry(parseInt(words[0]), parseInt(words[1]));
}

function ParseXref(text: String) : XRefEntry[] {
	let entries = new Array<XRefEntry>();

	// xref
	// 0 34
	// 0000000000 65535 f
	// 0000000040 00000 n
	// ....
	// 
	// 0000005605 00000 n
	// trailer
	// << /Size 34
	// ....
	// the first 2 lines ar not needed
	let lines = text.split(/\r\n|\r|\n/).slice(2);

	for(let line of lines) {
		if(line == "trailer") {
			break;
		}
		entries.push(ParseXrefLine(line));
	}

	return entries;
}

class PdfParser {
	private xrefEntries: XRefEntry[] = [];

	public ParsePdf(document: vscode.TextDocument) {
		console.log("parse started");


		let text = document.getText();

		// expected something like:
		// << /Size 6091 /Root 6090 0 R >>
		// startxref
		// 1040763
		// %%EOF
		let lastFewLines = text.slice(text.length - 50);

		let startxrefToken = "startxref";
		let startxrefTokenPosition = lastFewLines.search(startxrefToken);
		
		
		let xrefPosition = parseInt(lastFewLines.slice(startxrefTokenPosition + startxrefToken.length));
		let xrefAsString = text.slice(xrefPosition);
		this.xrefEntries = ParseXref(xrefAsString);

		console.log('parse finished');
	}

	public GetLocation(document: vscode.TextDocument, position: vscode.Position) : vscode.ProviderResult<vscode.Location> {

		let line = document.lineAt(position).text;

		let suffix = line.substr(position.character);
		
		let tokenOffset_R = suffix.search("R");
		if(tokenOffset_R < 0) {
			return null;
		}

		let prefix = line.substr(0, tokenOffset_R + position.character + 1);


		let regexResult = prefix.match(/([0-9]+) ([0-9]+) R$/);
		if(regexResult == null) {
			return null;
		}

		let objectNumber = parseInt(regexResult[1]);

		let objectOffset = this.xrefEntries[objectNumber];
		let objectPosition = document.positionAt(objectOffset.offset);
		let objectLocation = new vscode.Location(document.uri, objectPosition);

		return objectLocation;
	}
}

class PdfDefinitionProvider implements vscode.DefinitionProvider {
	// TODO place into a dictionary for each document
	private parser: PdfParser;
    private _disposable: vscode.Disposable;

	constructor() {
		this.parser = new PdfParser();

		let subscriptions: vscode.Disposable[] = [];
		vscode.window.onDidChangeActiveTextEditor(this.OnDocumentChanged, this, subscriptions);
		this._disposable = vscode.Disposable.from(...subscriptions);

		//this._disposable = vscode.window.onDidChangeActiveTextEditor(this.OnDocumentChanged, this);
		this.OnDocumentChanged();
	}

	private OnDocumentChanged() {
		console.log('OnDocumentChanged');
		let document = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document : null;
		if(!document) {
			return;
		}

		if(!document.fileName.endsWith("pdf")) {
			return;
		}

		this.parser.ParsePdf(document);
	}

	public dispose() {
        this._disposable.dispose();
    }
	
	
    public provideDefinition(
		document: vscode.TextDocument, 
		position: vscode.Position, 
		token: vscode.CancellationToken
	) : vscode.ProviderResult<vscode.Location> {

		console.log('provideDefinition');
		return this.parser.GetLocation(document, position);
    }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {


	context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
			{ language: "pdf" }, new PdfDefinitionProvider()));

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "helloworld-sample" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Meh!');
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
