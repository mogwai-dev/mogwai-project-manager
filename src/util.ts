import { invoke } from "@tauri-apps/api/core";


// デバッグ用制御変数
const SHOW_TABLE_INFO: boolean = true;

// 設定ディレクトリ内のファイルをすべて読み込む(*.list と *.table)
export async function getDir(path: string): Promise<string> {
  const ret = await invoke<string>("get_dir", {
    path,
  });

  return ret;
}

export async function joinPath(dirPath: string, fileName: string): Promise<string> {
  const ret = await invoke<string>("join_path", {
    dirPath,
    fileName,
  });

  return ret;
}


// ヘッダーとなる部分を抽出する
export function extractHeaderElement(
    file_name: string,
    list_text: string,
  ): HeaderElement[] {
    const lines = list_text.split("\n").map((line) => line.trim());
    const words_splited_with_comma = lines
      .map<string[]>((v) => v.split(","))
      .map<string[]>((v) => v.map<string>((vv) => vv.trim()));
  
    const id_and_key: HeaderElement[] = words_splited_with_comma.map<
      HeaderElement
    >((v) => {
      return new HeaderElement(
        file_name, // file_name
        v[0], // id
        v[v.length - 1], // represent_name
      );
    });
  
    return id_and_key;
  }

  
export class HeaderElement {
    file_name: string;
    id: string; // unique な数値
    represent_name: string; // 表示する名前
  
    constructor(file_name: string, id: string, represent_name: string) {
      this.file_name = file_name;
      this.id = id;
      this.represent_name = represent_name;
    }
  
    matrixKey(): string {
      return `${this.file_name}:${this.id}`;
    }
  
    debug_repr(): string {
      return `${this.id}:${this.represent_name}`;
    }
  
    // ヘッダーに表示される文字列を取得する
    repr(): string {
      return !SHOW_TABLE_INFO ? this.represent_name : this.debug_repr();
    }
  }
  
  
