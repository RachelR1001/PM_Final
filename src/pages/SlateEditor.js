import React, { useMemo, useState, useEffect } from 'react';
import { createEditor } from 'slate';
import { Slate, Editable, withReact, ReactEditor } from 'slate-react';

const SlateEditor = ({ initialContent }) => {
    const editor = useMemo(() => withReact(createEditor()), []);
    const [value, setValue] = useState(
        Array.isArray(initialContent) && initialContent.length > 0
            ? initialContent
            : [
                  {
                      type: 'paragraph',
                      children: [{ text: 'No content available.' }],
                  },
              ]
    );

    useEffect(() => {
        if (Array.isArray(initialContent) && initialContent.length > 0) {
            setValue(initialContent);
        }
    }, [initialContent]);

    // 示例：使用 ReactEditor 检查焦点状态
    const handleFocusCheck = () => {
        if (ReactEditor.isFocused(editor)) {
            console.log('Editor is focused');
        } else {
            console.log('Editor is not focused');
        }
    };

    return (
        <div>
            <button onClick={handleFocusCheck}>Check Focus</button>
            <Slate editor={editor} value={value} onChange={(newValue) => setValue(newValue)}>
                <Editable
                    style={{
                        border: '1px solid #d9d9d9',
                        borderRadius: '4px',
                        padding: '16px',
                        minHeight: '400px',
                        background: '#fff',
                    }}
                />
            </Slate>
        </div>
    );
};

export default SlateEditor;
