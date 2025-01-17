import { FC, useState } from "react";
import { writeTextFile } from "@tauri-apps/plugin-fs";

export interface ListPageProp {
  text: string,
  path: string,
}

export const ListPage: FC<ListPageProp> = ( { text, path } ) => {
    const [textareaValue, setTextareaValue] = useState<string>(text);
    const [lastTextareaValue, setLastTextareaValue] = useState<string>(text); // 最後にセーブボタンを押された文字列

    const hasDifference = textareaValue !== lastTextareaValue;

    const classWhenHasDiff = hasDifference
      ? "border-orange-300"
      : "border-gray-300";
    const buttonClassWhenHasDiff = hasDifference
      ? "bg-orange-500 hover:bg-orange-700"
      : "bg-gray-500";

    return (
      <div className="mx-2">
        <label
          htmlFor="message"
          className="block my-1 text-sm font-medium text-gray-900 dark:text-white"
        >
          {path}
        </label>
        <textarea
          id="message"
          rows={4}
          className={`block my-2 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border ${classWhenHasDiff} focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500`}
          placeholder={textareaValue}
          value={textareaValue}
          onChange={(e) => {
            setTextareaValue(e.target.value);
          }}
        >
        </textarea>
        <button
          disabled={!hasDifference}
          className={`my-1 ${buttonClassWhenHasDiff} text-white font-bold py-1 px-2 rounded-full text-sm`}
          onClick={async () => {
            setLastTextareaValue(textareaValue);
            await writeTextFile(path, textareaValue);
          }}
        >
          save
        </button>
      </div>
    );
};


