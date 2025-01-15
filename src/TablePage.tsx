import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { Tooltip } from "react-tooltip";
import MyTooltip from "./MyTooltip";

// デバッグ用制御変数
const SHOW_TABLE_INFO: boolean = true;

// 設定ディレクトリ内のファイルをすべて読み込む(*.list と *.table)
async function getDir(path: string): Promise<string> {
  const ret = await invoke<string>("get_dir", {
    path,
  });

  return ret;
}

async function joinPath(dirPath: string, fileName: string): Promise<string> {
  const ret = await invoke<string>("join_path", {
    dirPath,
    fileName,
  });

  return ret;
}

async function writeToTableFile(
  tablePageInfo: TablePageInfo,
) {
  let write_content = "' リストファイル一覧\n";

  for (const read_file_name of tablePageInfo.headerInfo.keys()) {
    write_content += `' ${read_file_name} \n`;
  }

  // 空行
  write_content += "\n";

  for (const row_key in tablePageInfo.matrix) {
    for (const col_key in tablePageInfo.matrix.matrix[row_key]) {
      if (
        tablePageInfo.matrix.matrix[row_key][col_key].mark !== "-" &&
        tablePageInfo.matrix.matrix[row_key][col_key].mark !== ""
      ) {
        write_content += `${row_key} --> ${col_key} ' ${
          tablePageInfo.matrix.matrix[row_key][col_key].description.replace(
            "\r\n",
            " ",
          )
            .replace("\n", " ")
        }\n`;
      }
    }
  }

  await writeTextFile(tablePageInfo.tableFilePath, write_content);
}

// テーブルのセル
class Cell {
  value: string | undefined;
  attrs: { [attr: string]: string }; // 属性の名前: その設定値
  isActive: boolean;
  onClick: () => void;
  onDblClick: () => void;
  protected key: string;

  constructor(key: string) {
    this.attrs = { "className": "border text-center" };
    this.isActive = true;
    this.onClick = () => {};
    this.onDblClick = () => {};
    this.key = key;
  }

  setValue(value: string) {
    this.value = value;
  }

  setOnClick(onClick: () => void) {
    this.onClick = onClick;
  }

  setOnDblClick(onDblClick: () => void) {
    this.onDblClick = onDblClick;
  }

  setIsActive(isActive: boolean) {
    this.isActive = isActive;
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  getKey(): string {
    return this.key;
  }

  setAttr(attr: string, value: string) {
    this.attrs[attr] = value;
  }

  asJsx(): JSX.Element {
    return (
      <td
        key={this.key}
        onClick={this.onClick}
        onDoubleClick={this.onDblClick}
        {...this.attrs}
      >
        {this.value}
      </td>
    );
  }
}

class HeaderCell extends Cell {
  constructor(key: string) {
    super(key);
  }

  asJsx(): JSX.Element {
    return (
      <th key={this.key} onClick={this.onClick} {...this.attrs}>
        {this.value}
      </th>
    );
  }
}

// テーブル
class Table {
  table: Cell[][];
  tablePageInfo: TablePageInfo;
  dblClickedData: DblClickedData | undefined;
  update: Dispatch<SetStateAction<TablePageInfo>>;
  updateDblClickedData: Dispatch<SetStateAction<DblClickedData | undefined>>;

  constructor(
    tablePageInfo: TablePageInfo,
    dblClickedData: DblClickedData | undefined,
    update: Dispatch<SetStateAction<TablePageInfo>>,
    updateDblClickedData: Dispatch<SetStateAction<DblClickedData | undefined>>,
  ) {
    this.tablePageInfo = tablePageInfo;
    this.dblClickedData = dblClickedData;
    this.update = update;
    this.updateDblClickedData = updateDblClickedData;

    let initRow: number = 2; // ヘッダーが 2 段になるので + 2
    let initCol: number = 2; // ヘッダーが 2 段になるので + 2

    for (const k of this.tablePageInfo.headerInfo.keys()) {
      // row
      if (this.tablePageInfo.headerInfo.get(k)?.isRowOpen) {
        initRow += this.tablePageInfo.headerInfo.get(k)!.headerElements.length;
      } else {
        initRow += 1; // headerElements が 1 にまとまって ファイル名のみとなる
      }

      // col
      if (this.tablePageInfo.headerInfo.get(k)?.isColOpen) {
        initCol += this.tablePageInfo.headerInfo.get(k)!.headerElements.length;
      } else {
        initCol += 1; // headerElements が 1 にまとまって ファイル名のみとなる
      }
    }

    /* 行列の初期化 */
    this.table = [];

    for (let i = 0; i < initRow; i++) {
      this.table[i] = [];
      for (let j = 0; j < initCol; j++) {
        // 1 行目, 2 行目 は header
        if (i == 0 || i == 1 || j == 0 || j == 1) {
          this.table[i].push(new HeaderCell(`header_row_${i}_col_${j}`));
        } else {
          this.table[i].push(new Cell(`content_row_${i}_col_${j}`));
        }
      }
    }
  }

  setAttrAt(row: number, col: number, attrs: { [attr: string]: string }) {
    for (const attr in attrs) {
      this.table[row][col].setAttr(attr, attrs[attr]);
    }
  }

  setContentValueAt(
    row: number,
    col: number,
    value: string,
    description: string,
  ) {
    this.table[row][col].setAttr("data-tooltip-id", "td-tooltip");
    this.table[row][col].setAttr("data-tooltip-content", description);

    this.table[row][col].setValue(value);
  }

  setFileNameAtCol(row: number, col: number, fileName: string) {
    const onClick: () => void = () => {
      this.tablePageInfo.headerInfo.get(fileName)!.isColOpen = !this
        .tablePageInfo.headerInfo.get(fileName)!.isColOpen;
      this.update({ ...this.tablePageInfo });
    };
    this.table[row][col].setOnClick(onClick);

    if (this.tablePageInfo.headerInfo.get(fileName)!.isColOpen) {
      this.table[row][col].setValue("▼" + fileName);
    } else {
      this.table[row][col].setValue("▶" + fileName);
    }
  }

  setFileNameAtRow(row: number, col: number, fileName: string) {
    const onClick: () => void = () => {
      this.tablePageInfo.headerInfo.get(fileName)!.isRowOpen = !this
        .tablePageInfo.headerInfo.get(fileName)!.isRowOpen;
      this.update({ ...this.tablePageInfo });
    };
    this.table[row][col].setOnClick(onClick);

    if (this.tablePageInfo.headerInfo.get(fileName)!.isRowOpen) {
      this.table[row][col].setValue("▼" + fileName);
    } else {
      this.table[row][col].setValue("▶" + fileName);
    }
  }

  setValueAt(row: number, col: number, value: string) {
    this.table[row][col].setValue(value);
  }

  getKeyAt(row: number, col: number): string {
    return this.table[row][col].getKey();
  }

  // (fromRow, fromCol) のセルから (toRow, toCol) までのセルを結合させる
  mergeCell(fromRow: number, fromCol: number, toRow: number, toCol: number) {
    const fromRowTmp = Math.min(fromRow, toRow);
    const toRowTmp = Math.max(fromRow, toRow);
    const fromColTmp = Math.min(fromCol, toCol);
    const toColTmp = Math.max(fromCol, toCol);

    for (let r = fromRowTmp; r <= toRowTmp; r++) {
      for (let c = fromColTmp; c <= toColTmp; c++) {
        if (r == fromRowTmp && c == fromColTmp) {
          // 結合セルの最初
          this.table[r][c].setIsActive(true);
          this.table[r][c].setAttr(
            "rowSpan",
            (toRowTmp - fromRowTmp + 1).toString(),
          );
          this.table[r][c].setAttr(
            "colSpan",
            (toColTmp - fromColTmp + 1).toString(),
          );
        } else {
          this.table[r][c].setIsActive(false);
        }
      }
    }
  }

  // table の jsx を生成する
  asJsx(): JSX.Element {
    this.setValueAt(0, 0, "(空欄)");
    this.mergeCell(0, 0, 1, 1); // 空欄

    // ヘッダー 0, 1 行目の設定
    let colAtRow0 = 2;
    for (const fileName of this.tablePageInfo.headerInfo.keys()) {
      if (this.tablePageInfo.headerInfo.get(fileName)!.isColOpen) {
        // 0 行目の設定
        this.mergeCell(
          0,
          colAtRow0,
          0,
          colAtRow0 +
            this.tablePageInfo.headerInfo.get(fileName)!.headerElements.length -
            1,
        );
        this.setFileNameAtCol(0, colAtRow0, fileName);

        // 1 行目の設定
        let colAtRow1 = colAtRow0;
        for (
          const element of this.tablePageInfo.headerInfo.get(fileName)!
            .headerElements
        ) {
          this.table[1][colAtRow1].setIsActive(true);
          this.setValueAt(1, colAtRow1, element.repr());
          colAtRow1 += 1;
        }

        colAtRow0 +=
          this.tablePageInfo.headerInfo.get(fileName)!.headerElements.length;
      } else {
        // close

        this.setFileNameAtCol(0, colAtRow0, fileName);

        colAtRow0 += 1; // 閉じているので 1 列に設定する
      }
    }

    // ヘッダー 0, 1 列目の値の設定
    let rowAtCol0 = 2;
    for (const fileName of this.tablePageInfo.headerInfo.keys()) {
      if (this.tablePageInfo.headerInfo.get(fileName)!.isRowOpen) {
        // 0 列目
        this.mergeCell(
          rowAtCol0,
          0,
          rowAtCol0 +
            this.tablePageInfo.headerInfo.get(fileName)!.headerElements.length -
            1,
          0,
        );

        this.setFileNameAtRow(rowAtCol0, 0, fileName);

        // 1 列目
        let rowAtCol1 = rowAtCol0;
        for (
          const element of this.tablePageInfo.headerInfo.get(fileName)!
            .headerElements
        ) {
          this.table[rowAtCol1][1].setIsActive(true);
          this.setValueAt(rowAtCol1, 1, element.repr());
          rowAtCol1 += 1;
        }

        rowAtCol0 +=
          this.tablePageInfo.headerInfo.get(fileName)!.headerElements.length;
      } else {
        // close
        this.setFileNameAtRow(rowAtCol0, 0, fileName);
        this.setValueAt(rowAtCol0, 1, "");

        rowAtCol0 += 1; // 閉じているので 1 列に設定する
      }
    }

    // ヘッダーじゃない部分の設定
    let fileBaseCol = 0; // ファイル間のテーブルが始まる位置
    let fileBaseRow = 0; // ファイル間のテーブルが始まる位置
    for (const fileNameRow of this.tablePageInfo.headerInfo.keys()) {
      for (const fileNameCol of this.tablePageInfo.headerInfo.keys()) {
        let contentCol = 0; // ファイル同士でのテーブル内でのインデックス
        let contentRow = 0; // ファイル同士でのテーブル内でのインデックス
        if (
          this.tablePageInfo.headerInfo.get(fileNameRow)!.isRowOpen &&
          this.tablePageInfo.headerInfo.get(fileNameCol)!.isColOpen
        ) {
          for (
            const heRow of this.tablePageInfo.headerInfo.get(fileNameRow)!
              .headerElements
          ) {
            // fileName の col が開いているとき
            for (
              const heCol of this.tablePageInfo.headerInfo.get(fileNameCol)!
                .headerElements
            ) {
              const mark = this.tablePageInfo.matrix.getMatrixValue(
                heRow.matrixKey(),
                heCol.matrixKey(),
              ).mark;

              if (mark === "-" || mark === "") {
                this.setValueAt(
                  2 + fileBaseRow + contentRow,
                  2 + fileBaseCol + contentCol,
                  mark,
                );
              } else {
                this.setContentValueAt(
                  2 + fileBaseRow + contentRow,
                  2 + fileBaseCol + contentCol,
                  this.tablePageInfo.matrix.getMatrixValue(
                    heRow.matrixKey(),
                    heCol.matrixKey(),
                  ).mark,
                  `${
                    this.tablePageInfo.matrix.getMatrixValue(
                      heRow.matrixKey(),
                      heCol.matrixKey(),
                    ).description
                  } ※ ダブルクリックで編集`,
                );
              }

              if (this.dblClickedData === undefined) {
                this
                  .table[2 + fileBaseRow + contentRow][
                    2 + fileBaseCol + contentCol
                  ].setOnDblClick(
                    ((updateDblClickedData: Dispatch<SetStateAction<DblClickedData | undefined>>, mark: string, key: string, description: string, heRowKey: string, heColKey: string) => {return () => {
                    updateDblClickedData({
                      id: key,
                      mark: mark === "" ? "-" : "〇",
                      description: description,
                      key_row: heRowKey,
                      key_col: heColKey,
                    })}})(this.updateDblClickedData, mark, this.getKeyAt(2 + fileBaseRow + contentRow, 2 + fileBaseCol + contentCol), this.tablePageInfo.matrix.getMatrixValue(
                      heRow.matrixKey(),
                      heCol.matrixKey(),
                    ).description, heRow.matrixKey(), heCol.matrixKey()));
                  
              } else {
              }

              contentCol += 1;
            }
            contentCol = 0;
            contentRow += 1;
          }
        } else if (
          this.tablePageInfo.headerInfo.get(fileNameRow)!.isRowOpen &&
          !this.tablePageInfo.headerInfo.get(fileNameCol)!.isColOpen
        ) {
          // fileName の col が閉じているとき

          for (
            const heRow of this.tablePageInfo.headerInfo.get(fileNameRow)!
              .headerElements
          ) {
            let combinedMark = "-";
            for (
              const heCol of this.tablePageInfo.headerInfo.get(fileNameCol)!
                .headerElements
            ) {
              if (
                this.tablePageInfo.matrix.getMatrixValue(
                  heRow.matrixKey(),
                  heCol.matrixKey(),
                ).mark === "〇"
              ) {
                combinedMark = "〇";
              }
            }
            this.setValueAt(
              2 + fileBaseRow + contentRow,
              2 + fileBaseCol + contentCol,
              combinedMark,
            );
            contentRow += 1;
          }

          contentCol += 1;
        } else if (
          !this.tablePageInfo.headerInfo.get(fileNameRow)!.isRowOpen &&
          this.tablePageInfo.headerInfo.get(fileNameCol)!.isColOpen
        ) {
          // row が閉じているとき
          for (
            const heCol of this.tablePageInfo.headerInfo.get(fileNameCol)!
              .headerElements
          ) {
            let combinedMark = "-";
            for (
              const heRow of this.tablePageInfo.headerInfo.get(fileNameRow)!
                .headerElements
            ) {
              if (
                this.tablePageInfo.matrix.getMatrixValue(
                  heRow.matrixKey(),
                  heCol.matrixKey(),
                ).mark === "〇"
              ) {
                combinedMark = "〇";
              }
            }
            this.setValueAt(
              2 + fileBaseRow + contentRow,
              2 + fileBaseCol + contentCol,
              combinedMark,
            );
            contentCol += 1;
          }
          contentRow += 1;
        } else {
          let combinedMark = "-";
          for (
            const heRow of this.tablePageInfo.headerInfo.get(fileNameCol)!
              .headerElements
          ) {
            for (
              const heCol of this.tablePageInfo.headerInfo.get(fileNameCol)!
                .headerElements
            ) {
              if (
                this.tablePageInfo.matrix.getMatrixValue(
                  heRow.matrixKey(),
                  heCol.matrixKey(),
                ).mark === "〇"
              ) {
                combinedMark = "〇";
              }
            }
          }
          this.setValueAt(
            2 + fileBaseRow + contentRow,
            2 + fileBaseCol + contentCol,
            combinedMark,
          );
          contentRow += 1;
          contentCol += 1;
        }

        if (this.tablePageInfo.headerInfo.get(fileNameCol)!.isColOpen) {
          fileBaseCol +=
            this.tablePageInfo.headerInfo.get(fileNameCol)!.headerElements
              .length;
        } else {
          fileBaseCol += 1;
        }
      }

      fileBaseCol = 0;

      if (this.tablePageInfo.headerInfo.get(fileNameRow)!.isRowOpen) {
        fileBaseRow +=
          this.tablePageInfo.headerInfo.get(fileNameRow)!.headerElements.length;
      } else {
        fileBaseRow += 1;
      }
    }

    // <thead> の中身を作る
    const theadRows: JSX.Element[] = [];

    // 1 行目と 2 行目は <thead> に入れる
    for (let i = 0; i < 2; i++) {
      const thCols = [];
      for (const j in this.table[i]) {
        if (this.table[i][j].getIsActive()) {
          thCols.push(this.table[i][j].asJsx());
        }
      }
      theadRows.push(<tr key={`row_${i}`}>{thCols}</tr>);
    }

    const tbodyRows: JSX.Element[] = [];
    // 2 行目以降は <tbody> に入れる
    for (let i = 2; i < this.table.length; i++) {
      const tbodyCols: JSX.Element[] = [];
      for (const j in this.table[i]) {
        if (this.table[i][j].getIsActive()) {
          tbodyCols.push(this.table[i][j].asJsx());
        }
      }
      tbodyRows.push(<tr key={`row_${i}`}>{tbodyCols}</tr>);
    }

    // Tooltip
    const tooltip: JSX.Element = <Tooltip id={"td-tooltip"} />;
    // if (this.dblClickedData === undefined) {

    //}
    // else {
    // tooltip = <MyTooltip />
    // }

    return (
      <div>
        <table>
          <thead>
            {theadRows}
          </thead>
          <tbody>
            {tbodyRows}
          </tbody>
        </table>
        {tooltip}
      </div>
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

// ヘッダーとなる部分を抽出する
function extractHeaderElement(
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
  matrix: { [rowKey: string]: { [columnKey: string]: MatrixValue } };

  constructor() {
    this.matrix = {};
  }

  register_arrow(
    fileNameFrom: string,
    idFrom: string,
    fileNameTo: string,
    idTo: string,
    description: string,
    mark: string,
  ) {
    if (!this.matrix[`${fileNameFrom}:${idFrom}`]) {
      this.matrix[`${fileNameFrom}:${idFrom}`] = {};
    }

    if (
      !this.matrix[`${fileNameFrom}:${idFrom}`][`${fileNameTo}:${idTo}`]
    ) {
      this.matrix[`${fileNameFrom}:${idFrom}`][`${fileNameTo}:${idTo}`] = {
        mark: "",
        description: "",
      };
    }

    this.matrix[`${fileNameFrom}:${idFrom}`][`${fileNameTo}:${idTo}`] = {
      mark,
      description,
    };
  }

  getMatrixValue(
    key_from: string,
    key_to: string,
  ): MatrixValue {
    if (!this.matrix[key_from]) {
      this.matrix[key_from] = {};
    }

    if (!this.matrix[key_from][key_to]) {
      this.matrix[key_from][key_to] = { mark: "-", description: "" };
    }

    return this.matrix[key_from][key_to];
  }
}

type HeaderInfo = Map<
  string,
  { headerElements: HeaderElement[]; isRowOpen: boolean; isColOpen: boolean }
>;

// 読み込んだテーブルファイルの情報
class TablePageInfo {
  matrix: Matrix; // ヘッダーを含まない行列の値
  headerInfo: HeaderInfo;
  tableFilePath: string;

  static empty(): TablePageInfo {
    return new TablePageInfo(
      new Matrix(),
      new Map(),
      "",
    );
  }

  constructor(matrix: Matrix, headerInfo: HeaderInfo, tableFilePath: string) {
    this.matrix = matrix;
    this.headerInfo = headerInfo;
    this.tableFilePath = tableFilePath;
  }
}

enum ReadState {
  SkipInitialLine,
  ReadFileName,
  ReadArrow,
}

// td の属性を取得する関数
// 毎レンダーごとに呼ばれる
function getContentTdAttr(
  matrix: Matrix,
  he_row: HeaderElement,
  he_col: HeaderElement,
  dblclicked_tooltip_data: DblClickedData | undefined,
  index_row: number,
  index_col: number,
): { [attr_key: string]: string } {
  if (
    matrix.getMatrixValue(he_row.matrixKey(), he_col.matrixKey()).mark ===
      "" ||
    matrix.getMatrixValue(he_row.matrixKey(), he_col.matrixKey()).mark ===
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
          matrix.getMatrixValue(
            he_row.matrixKey(),
            he_col.matrixKey(),
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

const generate_table_page = (path: string) => {
  return () => {
    /* 状態管理 */
    const [tablePageInfo, setTablePageInfo] = useState<TablePageInfo>(
      TablePageInfo.empty(),
    );
    const [dblClickedData, setDblClickedData] = useState<
      DblClickedData | undefined
    >(undefined);

    console.log(dblClickedData);

    // 変更ハンドラーを定義します

    const hasRun = useRef(false);
    const initialize = async () => {
      const matrixTmp: Matrix = new Matrix();
      const headerInfo: HeaderInfo = new Map();

      const text = await readTextFile(path);

      // path を保存しておく
      const readTableFilePath = path;

      // 先頭のコメントを読み込むが
      // 1 行目は飛ばす
      let readState: ReadState = ReadState.SkipInitialLine;
      const splited = text.split("\n").map((line) => line.trim());
      let lineNum = 0; // 現在読んでいる行数

      // 現在読んでいる行数が "\n" で分けた行数より大きくなったら終わり
      while (lineNum < splited.length) {
        const line = splited[lineNum];

        if (readState === ReadState.SkipInitialLine) {
          readState = ReadState.ReadFileName;
          lineNum += 1;
        } else if (readState === ReadState.ReadFileName) {
          if (line.startsWith("'")) {
            const fileName = line.slice(1).trim(); // 1 文字目以降を取得
            const dirName = await getDir(path);
            const filePath = await joinPath(dirName, fileName);

            const listText = await readTextFile(filePath);

            headerInfo.set(fileName, {
              headerElements: extractHeaderElement(fileName, listText),
              isRowOpen: true,
              isColOpen: true,
            });

            lineNum += 1;
          } else {
            readState = ReadState.ReadArrow;
          }
        } else if (readState === ReadState.ReadArrow) {
          if (line.includes("-->") || line.includes("<--")) {
            const splitedWithSpace = line.split(" ");

            const [fileNameLeft, idLeft] = splitedWithSpace[0].split(":");
            const [fileNameRight, idRight] = splitedWithSpace[2].split(
              ":",
            );

            let description;
            // コメントの抽出(簡易版)
            if (line.includes("'")) {
              description = line.slice(line.lastIndexOf("'")).slice(1).trim();
            } else {
              description = "";
            }

            if (splitedWithSpace[1] === "-->") {
              matrixTmp.register_arrow(
                fileNameLeft,
                idLeft,
                fileNameRight,
                idRight,
                description,
                "〇",
              );
            } else if (splitedWithSpace[1] === "<--") {
              matrixTmp.register_arrow(
                fileNameRight,
                idRight,
                fileNameLeft,
                idLeft,
                description,
                "〇",
              );
            }
          }

          lineNum += 1;
        }
      }

      setTablePageInfo(
        new TablePageInfo(matrixTmp, headerInfo, readTableFilePath),
      );
    };

    useEffect(() => {
      if (!hasRun.current) {
        hasRun.current = true;
        initialize();
      }
    }, []);

    // tbody を生成
    //const generate_table_content: () => JSX.Element[] = () => {
    //  const table_content = [];
    //  let sum_of_row = 0; // 表示した列の総数
    //  for (const file_name in file_name_header_elem) {
    //    for (const index in file_name_header_elem[file_name]) {
    //      ((row_index) => {
    //        table_content.push(
    //          <tr key={`header_row_${row_index}`}>
    //            {index === "0"
    //              ? (
    //                <td
    //                  key={`header_row_${row_index}_col_0`}
    //                  className="border text-center"
    //                  rowSpan={file_name_header_elem[file_name].length}
    //                >
    //                  {file_name}
    //                </td>
    //              )
    //              : ""}
    //            <td
    //              key={`header_row_${row_index}_col_1`}
    //              className="border text-center"
    //            >
    //              {file_name_header_elem[file_name][index].repr()}
    //            </td>
    //            {header_elements.map((he_col, index_col) => (
    //              <td
    //                key={`content_row_${row_index}_col_${index_col}`}
    //                className="border text-center"
    //                onDoubleClick={() => {
    //                  setDblclickTooltipId(
    //                    {
    //                      id: `content_row_${row_index}_col_${index_col}`,
    //                      mark: tablePageInfo.get_matrix_value(
    //                        file_name_header_elem[file_name][index]
    //                          .matrix_key(),
    //                        he_col.matrix_key(),
    //                      ).mark ||
    //                        "-",
    //                      description: `${
    //                        tablePageInfo.get_matrix_value(
    //                          file_name_header_elem[file_name][index]
    //                            .matrix_key(),
    //                          he_col.matrix_key(),
    //                        ).description
    //                      }`,
    //                      key_row: file_name_header_elem[file_name][index]
    //                        .matrix_key(),
    //                      key_col: he_col.matrix_key(),
    //                    },
    //                  );
    //                }}
    //                {...get_content_td_attr(
    //                  tablePageInfo,
    //                  file_name_header_elem[file_name][index],
    //                  he_col,
    //                  dblclickedTooltipData,
    //                  row_index,
    //                  index_col,
    //                )}
    //              >
    //                {tablePageInfo.get_matrix_value(
    //                  file_name_header_elem[file_name][index].matrix_key(),
    //                  he_col.matrix_key(),
    //                ).mark ||
    //                  "-"}
    //              </td>
    //            ))}
    //          </tr>,
    //        );
    //      })(sum_of_row);
    //
    //      sum_of_row += 1;
    //    }
    //  }
    //  return table_content;
    //};

    // 空の依存配列により、コンポーネントのマウント時にのみ実行される
    return (
      <div className="mx-2">
        <label className="block my-1 text-sm font-medium text-gray-900 dark:text-white">
          {path}
        </label>
        {
          new Table(
            tablePageInfo,
            dblClickedData,
            setTablePageInfo,
            setDblClickedData,
          ).asJsx()
          // <table className="table-fixed">
          //   <thead>
          //     <tr key="header_file_row_0">
          //       {/* ファイル名を入れる Header 行を追加 */}
          //       <td className="border text-center" key="header_row_0_col_0">
          //         (空欄)
          //       </td>
          //       <td className="border text-center" key="header_row_0_col_1">
          //         (空欄)
          //       </td>
          //       {Object.keys(file_name_header_elem).map((file_name, index) => (
          //         <td
          //           className="border text-center"
          //           key={`header_row_0+col_${index + 2}`}
          //           colSpan={file_name_header_elem[file_name].length}
          //         >
          //           {file_name}
          //         </td>
          //       ))}
          //     </tr>
          //     <tr key={"header_row_0"}>
          //       <td className="border text-center" key="header_row_1_col_0">
          //         (空欄)
          //       </td>
          //       <td className="border text-center" key="header_row_1_col_1">
          //         (空欄)
          //       </td>
          //       {header_elements.map((e, index) => (
          //         <td key={`header_row_1_col_${index + 2}`} className="border">
          //           {e.repr()}
          //         </td>
          //       ))}
          //     </tr>
          //   </thead>
          //   <tbody>
          //     {generate_table_content()}
          //   </tbody>
          // </table>
        }
        {
          //dblclickedTooltipData === undefined
          // ? <Tooltip id={"td-tooltip"} />
          // : (
          //   <Tooltip
          //     id={dblclickedTooltipData.id}
          //     isOpen={true}
          //     clickable={true}
          //   >
          //     <label
          //       htmlFor="line_selection"
          //       className="block text-sm font-light text-white dark:text-white"
          //     >
          //       影響状態
          //     </label>
          //     <select
          //       id="line_selection"
          //       className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          //       defaultValue={dblclickedTooltipData.mark}
          //       onChange={dblclicked_tooltip_mark_change}
          //     >
          //       <option value="〇">〇</option>
          //       <option value="-">-</option>
          //     </select>
          //     <label
          //       htmlFor="description-input"
          //       className="block text-sm font-light text-white dark:text-white"
          //     >
          //       説明
          //     </label>
          //     <input
          //       type="text"
          //       id="description-input"
          //       className="block w-full text-gray-900 border border-gray-300 rounded-lg bg-gray-50 text-xs focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          //       defaultValue={dblclickedTooltipData.description}
          //       onChange={dblclicked_tooltip_description_change}
          //     />
          //
          //     <div className="mt-2 inline-flex justify-center">
          //       <button
          //         onClick={() => {
          //           setDblclickTooltipId(undefined); // ツールチップを戻す
          //         }}
          //         className="px-1 py-1 text-xs text-white border border-gray-300 rounded-md"
          //       >
          //         破棄して閉じる
          //       </button>
          //       <button
          //         onClick={() => {
          //           setDblclickTooltipId(undefined); // ツールチップを戻す
          //           tablePageInfo.matrix.getMatrixValue(
          //             dblclickedTooltipData.key_row,
          //             dblclickedTooltipData.key_col,
          //           ).mark = dblclicked_tooltip_mark;
          //           tablePageInfo.matrix.getMatrixValue(
          //             dblclickedTooltipData.key_row,
          //             dblclickedTooltipData.key_col,
          //           ).description = dblclickedTooltipDescription;
          //           setTablePageInfo(tablePageInfo);
          //         }}
          //         className="px-1 py-1 text-xs text-white border border-gray-300 rounded-md"
          //       >
          //         保存して閉じる
          //       </button>
          //     </div>
          //   </Tooltip>
          // )
        }
        <button
          onClick={async () => {
            await writeToTableFile(tablePageInfo);
          }}
        >
          保存
        </button>
      </div>
    );
  };
};

export default generate_table_page;
