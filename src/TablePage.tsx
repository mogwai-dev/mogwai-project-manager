import { useEffect, useRef, useState } from "react";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { Tooltip } from "react-tooltip";

// デバッグ用制御変数
const SHOW_TABLE_INFO: boolean = true;

// 設定ディレクトリ内のファイルをすべて読み込む(*.list と *.table)
async function get_dir(path: string): Promise<string> {
  const ret = await invoke<string>("get_dir", {
    path,
  });

  return ret;
}

async function join_path(dirPath: string, fileName: string): Promise<string> {
  const ret = await invoke<string>("join_path", {
    dirPath,
    fileName,
  });

  return ret;
}

async function write_to_tablefile(
  matrix: Matrix,
  read_file_info: ReadFileInfo,
) {
  let write_content = "' リストファイル一覧\n";

  for (const read_file_name of read_file_info.read_list_file_names) {
    write_content += `' ${read_file_name} \n`;
  }

  // 空行
  write_content += "\n";

  for (const row_key in matrix.matrix) {
    for (const col_key in matrix.matrix[row_key]) {
      if (
        matrix.matrix[row_key][col_key].mark !== "-" &&
        matrix.matrix[row_key][col_key].mark !== ""
      ) {
        write_content += `${row_key} --> ${col_key} ' ${
          matrix.matrix[row_key][col_key].description.replace("\r\n", " ")
            .replace("\n", " ")
        }\n`;
      }
    }
  }

  await writeTextFile(read_file_info.read_table_file_path, write_content);
}

// テーブルのセル
class Cell {
  value: string | undefined;
  attrs: { [attr: string]: string }; // 属性の名前: その設定値
  private isActive: boolean;

  constructor() {
    this.attrs = {"className": "border text-center"};
    this.isActive = true;
  }

  setValue(value: string) {
    this.value = value;
  }

  setIsActive(isActive: boolean) {
    this.isActive = isActive;
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  setAttr(attr:string, value: string) {
    this.attrs[attr] = value;
  }

  asJsx(): JSX.Element {
    return <td {...this.attrs}>{this.value}</td>;
  }
}

// テーブル
class Table {
  table: Cell[][];

  constructor(init_row: number, init_col: number) {
    /* 行列の初期化 */
    this.table = [];

    for (let i = 0; i < init_row; i++) {
      this.table[i] = [];
      for (let j = 0; j < init_col; j++) {
          this.table[i].push(new Cell());
      }
    }
  }

  setAttrAt(row: number, col: number, attrs: { [attr: string]: string }) {
    for (const attr in attrs) {
      this.table[row][col].setAttr(attr, attrs[attr]);
    }
  }

  setValueAt(row: number, col: number, value: string) {
    this.table[row][col].setValue(value);
  }

  // (fromRow, fromCol) のセルから (toRow, toCol) までのセルを結合させる
  mergeCell(fromRow: number, fromCol: number, toRow: number, toCol: number) {
    const fromRowTmp = Math.min(fromRow, toRow);
    const toRowTmp = Math.max(fromRow, toRow);
    const fromColTmp = Math.min(fromCol, toCol);
    const toColTmp = Math.max(fromCol, toCol);

    for (let r = fromRowTmp; r <=  toRowTmp; r++) {
      for (let c = fromColTmp; c <= toColTmp; c++) {
        if (r == fromRowTmp && c == fromColTmp) {
          // 結合セルの最初
          this.table[r][c].setIsActive(true);
          this.table[r][c].setAttr("rowSpan", (toRowTmp-fromRowTmp).toString());
          this.table[r][c].setAttr("colSpan", (toColTmp-fromColTmp).toString());
        }
        else {
          this.table[r][c].setIsActive(false);
        }
      }
    }
  }

  asJsx(): JSX.Element {
    const rows: JSX.Element[] = [];

    for (const i in this.table) {
      const cols: JSX.Element[] = [];
      for (const j in this.table[i]) {
        if (this.table[i][j].getIsActive()) {
          cols.push(this.table[i][j].asJsx());
        }
      }
      rows.push(<tr>{cols}</tr>);
    }

    return (
      <table>
        {rows}
      </table>
    );
  }
}

class HeaderElement {
  file_name: string;
  id: string; // unique な数値
  represent_name: string; // 表示する名前

  constructor(file_name: string, id: string, represent_name: string) {
    this.file_name = file_name;
    this.id = id;
    this.represent_name = represent_name;
  }

  matrix_key(): string {
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

// ヘッダーとなる部分を抽出する
function extract_header_element(
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

// matrix["x.list:1"]["y.list:1"] = 'o' みたいな....
type MatrixValue = { mark: string; description: string };

class Matrix {
  matrix: { [row_key: string]: { [column_key: string]: MatrixValue } };

  constructor() {
    this.matrix = {};
  }

  register_arrow(
    file_name_from: string,
    id_from: string,
    file_name_to: string,
    id_to: string,
    description: string,
    mark: string,
  ) {
    if (!this.matrix[`${file_name_from}:${id_from}`]) {
      this.matrix[`${file_name_from}:${id_from}`] = {};
    }

    if (
      !this.matrix[`${file_name_from}:${id_from}`][`${file_name_to}:${id_to}`]
    ) {
      this.matrix[`${file_name_from}:${id_from}`][`${file_name_to}:${id_to}`] =
        { mark: "", description: "" };
    }

    this.matrix[`${file_name_from}:${id_from}`][`${file_name_to}:${id_to}`] = {
      mark,
      description,
    };
  }

  get_matrix_value(
    key_from: string,
    key_to: string,
  ): MatrixValue {
    if (!this.matrix[key_from]) {
      this.matrix[key_from] = {};
    }

    if (!this.matrix[key_from][key_to]) {
      this.matrix[key_from][key_to] = { mark: "", description: "" };
    }

    return this.matrix[key_from][key_to];
  }
}

enum ReadState {
  SkipInitialLine,
  ReadFileName,
  ReadArrow,
}

// td の属性を取得する関数
// 毎レンダーごとに呼ばれる
//
function get_content_td_attr(
  matrix: Matrix,
  he_row: HeaderElement,
  he_col: HeaderElement,
  dblclicked_tooltip_data: DblClickedData | undefined,
  index_row: number,
  index_col: number,
): { [attr_key: string]: string } {
  if (
    matrix.get_matrix_value(he_row.matrix_key(), he_col.matrix_key()).mark ===
      "" ||
    matrix.get_matrix_value(he_row.matrix_key(), he_col.matrix_key()).mark ===
      "-"
  ) {
    if (dblclicked_tooltip_data === undefined) {
      return {};
    } else {
      // ダブルクリックされた td が存在する
      return {
        "data-tooltip-id": `content_row_${index_row}_col_${index_col}`,
      };
    }
  } else {
    if (dblclicked_tooltip_data === undefined) {
      return {
        "data-tooltip-id": "td-tooltip",
        "data-tooltip-content": `${
          matrix.get_matrix_value(
            he_row.matrix_key(),
            he_col.matrix_key(),
          ).description
        } ※ダブルクリックで編集できます`,
      };
    } else {
      // ダブルクリックされた td が存在する
      return {
        "data-tooltip-id": `content_row_${index_row}_col_${index_col}`,
      };
    }
  }
}

interface DblClickedData {
  id: string;
  mark: string;
  description: string;
  key_row: string;
  key_col: string;
}

interface ReadFileInfo {
  read_table_file_path: string;
  read_list_file_names: string[];
}

const generate_table_page = (path: string) => {
  return () => {
    /* 状態管理 */
    const [header_elements, set_header_element] = useState<HeaderElement[]>([]);
    const [matrix, set_matrix] = useState<Matrix>(new Matrix());
    const [dblclicked_tooltip_data, set_dblclick_tooltip_id] = useState<
      DblClickedData | undefined
    >(undefined);
    const [dblclicked_tooltip_description, set_dblclicked_tooltip_description] =
      useState<string>("");

    // initialize 関数内で初期化が行われる
    const [read_file_info, set_read_file_info] = useState<ReadFileInfo>({
      read_table_file_path: "",
      read_list_file_names: [],
    });

    // 変更ハンドラーを定義します
    const dblclicked_tooltip_description_change = (
      e: React.ChangeEvent<HTMLInputElement>,
    ) => {
      set_dblclicked_tooltip_description(e.target.value);
    };

    const [dblclicked_tooltip_mark, set_dblclicked_tooltip_mark] = useState<
      string
    >("");

    const dblclicked_tooltip_mark_change = (
      e: React.ChangeEvent<HTMLSelectElement>,
    ) => {
      set_dblclicked_tooltip_mark(e.target.value);
    };

    const hasRun = useRef(false);
    const initialize = async () => {
      let header_element_tmp: HeaderElement[] = [];
      const matrix_tmp: Matrix = new Matrix();

      const text = await readTextFile(path);

      // path を保存しておく
      const read_table_file_path = path;
      const read_list_file_names = [];

      // 先頭のコメントを読み込むが
      // 1 行目は飛ばす
      let read_state: ReadState = ReadState.SkipInitialLine;
      const splited = text.split("\n").map((line) => line.trim());
      let line_num = 0; // 現在読んでいる行数
      // 現在読んでいる行数が "\n" で分けた行数より大きくなったら終わり
      while (line_num < splited.length) {
        const line = splited[line_num];

        if (read_state === ReadState.SkipInitialLine) {
          read_state = ReadState.ReadFileName;
          line_num += 1;
        } else if (read_state === ReadState.ReadFileName) {
          if (line.startsWith("'")) {
            const file_name = line.slice(1).trim(); // 1 文字目以降を取得
            read_list_file_names.push(file_name);
            const dir_name = await get_dir(path);
            const file_path = await join_path(dir_name, file_name);

            const list_text = await readTextFile(file_path);
            header_element_tmp = header_element_tmp.concat(
              extract_header_element(file_name, list_text),
            );
            line_num += 1;
          } else {
            read_state = ReadState.ReadArrow;
          }
        } else if (read_state === ReadState.ReadArrow) {
          if (line.includes("-->") || line.includes("<--")) {
            const splited_with_space = line.split(" ");

            const [file_name_left, id_left] = splited_with_space[0].split(":");
            const [file_name_right, id_right] = splited_with_space[2].split(
              ":",
            );

            let description;
            // コメントの抽出(簡易版)
            if (line.includes("'")) {
              description = line.slice(line.lastIndexOf("'")).slice(1).trim();
            } else {
              description = "";
            }

            if (splited_with_space[1] === "-->") {
              matrix_tmp.register_arrow(
                file_name_left,
                id_left,
                file_name_right,
                id_right,
                description,
                "〇",
              );
            } else if (splited_with_space[1] === "<--") {
              matrix_tmp.register_arrow(
                file_name_right,
                id_right,
                file_name_left,
                id_left,
                description,
                "〇",
              );
            }
          }

          line_num += 1;
        }
      }

      set_header_element([...header_elements, ...header_element_tmp]);
      set_matrix(matrix_tmp);
      set_read_file_info({
        read_table_file_path,
        read_list_file_names,
      });
    };

    useEffect(() => {
      if (!hasRun.current) {
        hasRun.current = true;
        initialize();
      }

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // あらかじめ、HeaderElement から ファイルを抽出しておく
    const file_name_header_elem: { [file_name: string]: HeaderElement[] } = {};

    for (const he of header_elements) {
      if (!file_name_header_elem[he.file_name]) {
        file_name_header_elem[he.file_name] = [];
      }
      file_name_header_elem[he.file_name].push(he);
    }

    // tbody を生成
    const generate_table_content: () => JSX.Element[] = () => {
      const table_content = [];
      let sum_of_row = 0; // 表示した列の総数
      for (const file_name in file_name_header_elem) {
        for (const index in file_name_header_elem[file_name]) {
          ((row_index) => {
            table_content.push(
              <tr key={`header_row_${row_index}`}>
                {index === "0"
                  ? (
                    <td
                      key={`header_row_${row_index}_col_0`}
                      className="border text-center"
                      rowSpan={file_name_header_elem[file_name].length}
                    >
                      {file_name}
                    </td>
                  )
                  : ""}
                <td
                  key={`header_row_${row_index}_col_1`}
                  className="border text-center"
                >
                  {file_name_header_elem[file_name][index].repr()}
                </td>
                {header_elements.map((he_col, index_col) => (
                  <td
                    key={`content_row_${row_index}_col_${index_col}`}
                    className="border text-center"
                    onDoubleClick={() => {
                      set_dblclick_tooltip_id(
                        {
                          id: `content_row_${row_index}_col_${index_col}`,
                          mark: matrix.get_matrix_value(
                            file_name_header_elem[file_name][index]
                              .matrix_key(),
                            he_col.matrix_key(),
                          ).mark ||
                            "-",
                          description: `${
                            matrix.get_matrix_value(
                              file_name_header_elem[file_name][index]
                                .matrix_key(),
                              he_col.matrix_key(),
                            ).description
                          }`,
                          key_row: file_name_header_elem[file_name][index]
                            .matrix_key(),
                          key_col: he_col.matrix_key(),
                        },
                      );
                    }}
                    {...get_content_td_attr(
                      matrix,
                      file_name_header_elem[file_name][index],
                      he_col,
                      dblclicked_tooltip_data,
                      row_index,
                      index_col,
                    )}
                  >
                    {matrix.get_matrix_value(
                      file_name_header_elem[file_name][index].matrix_key(),
                      he_col.matrix_key(),
                    ).mark ||
                      "-"}
                  </td>
                ))}
              </tr>,
            );
          })(sum_of_row);

          sum_of_row += 1;
        }
      }
      return table_content;
    };

    // 空の依存配列により、コンポーネントのマウント時にのみ実行される
    return (
      <div className="mx-2">
        <label className="block my-1 text-sm font-medium text-gray-900 dark:text-white">
          {path}
        </label>
        <table className="table-fixed">
          <thead>
            <tr key="header_file_row_0">
              {/* ファイル名を入れる Header 行を追加 */}
              <td className="border text-center" key="header_row_0_col_0">
                (空欄)
              </td>
              <td className="border text-center" key="header_row_0_col_1">
                (空欄)
              </td>
              {Object.keys(file_name_header_elem).map((file_name, index) => (
                <td
                  className="border text-center"
                  key={`header_row_0+col_${index + 2}`}
                  colSpan={file_name_header_elem[file_name].length}
                >
                  {file_name}
                </td>
              ))}
            </tr>
            <tr key={"header_row_0"}>
              <td className="border text-center" key="header_row_1_col_0">
                (空欄)
              </td>
              <td className="border text-center" key="header_row_1_col_1">
                (空欄)
              </td>
              {header_elements.map((e, index) => (
                <td key={`header_row_1_col_${index + 2}`} className="border">
                  {e.repr()}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {generate_table_content()}
          </tbody>
        </table>
        {dblclicked_tooltip_data === undefined
          ? <Tooltip id={"td-tooltip"} />
          : (
            <Tooltip
              id={dblclicked_tooltip_data.id}
              isOpen={true}
              clickable={true}
            >
              <label
                htmlFor="line_selection"
                className="block text-sm font-light text-white dark:text-white"
              >
                影響状態
              </label>
              <select
                id="line_selection"
                className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                defaultValue={dblclicked_tooltip_data.mark}
                onChange={dblclicked_tooltip_mark_change}
              >
                <option value="〇">〇</option>
                <option value="-">-</option>
              </select>
              <label
                htmlFor="description-input"
                className="block text-sm font-light text-white dark:text-white"
              >
                説明
              </label>
              <input
                type="text"
                id="description-input"
                className="block w-full text-gray-900 border border-gray-300 rounded-lg bg-gray-50 text-xs focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                defaultValue={dblclicked_tooltip_data.description}
                onChange={dblclicked_tooltip_description_change}
              />

              <div className="mt-2 inline-flex justify-center">
                <button
                  onClick={() => {
                    set_dblclick_tooltip_id(undefined); // ツールチップを戻す
                  }}
                  className="px-1 py-1 text-xs text-white border border-gray-300 rounded-md"
                >
                  破棄して閉じる
                </button>
                <button
                  onClick={() => {
                    set_dblclick_tooltip_id(undefined); // ツールチップを戻す
                    matrix.get_matrix_value(
                      dblclicked_tooltip_data.key_row,
                      dblclicked_tooltip_data.key_col,
                    ).mark = dblclicked_tooltip_mark;
                    matrix.get_matrix_value(
                      dblclicked_tooltip_data.key_row,
                      dblclicked_tooltip_data.key_col,
                    ).description = dblclicked_tooltip_description;
                    set_matrix(matrix);
                  }}
                  className="px-1 py-1 text-xs text-white border border-gray-300 rounded-md"
                >
                  保存して閉じる
                </button>
              </div>
            </Tooltip>
          )}
        <button
          onClick={async () => {
            await write_to_tablefile(matrix, read_file_info);
          }}
        >
          保存
        </button>
        <p>{dblclicked_tooltip_data ? dblclicked_tooltip_data.id : ""}</p>
      </div>
    );
  };
};

export default generate_table_page;
