import { useState } from "react";
import { writeTextFile } from "@tauri-apps/plugin-fs";


const generate_list_page = (text: string, path: string) => {
  return () => {
    const [textarea_value, set_textarea_value] = useState(text);
    const [last_textarea_value, set_last_textarea_value] = useState(text); // 最後にセーブボタンを押された文字列

    const has_difference = textarea_value !== last_textarea_value;

    const class_when_has_diff = has_difference
      ? "border-orange-300"
      : "border-gray-300";
    const button_class_when_has_diff = has_difference
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
          className={`block my-2 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border ${class_when_has_diff} focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500`}
          placeholder={textarea_value}
          value={textarea_value}
          onChange={(e) => {
            set_textarea_value(e.target.value);
          }}
        >
        </textarea>
        <button
          disabled={!has_difference}
          className={`my-1 ${button_class_when_has_diff} text-white font-bold py-1 px-2 rounded-full text-sm`}
          onClick={async () => {
            set_last_textarea_value(textarea_value);
            await writeTextFile(path, textarea_value);
          }}
        >
          save
        </button>
      </div>
    );
  };
};

export default generate_list_page;
