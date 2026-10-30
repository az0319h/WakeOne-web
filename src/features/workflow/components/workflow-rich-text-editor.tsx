'use client';

import { useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import { FontSize, TextStyle } from '@tiptap/extension-text-style';
import { Placeholder } from '@tiptap/extensions';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { WORKFLOW_RICH_CONTENT_CLASS } from '../lib/rich-content-class';

const FONT_SIZES = [
  { value: '12px', label: '12px' },
  { value: '14px', label: '14px' },
  { value: '18px', label: '18px' }
] as const;
const DEFAULT_FONT_SIZE = '14px';

const SAFE_LINK_PATTERN = /^(https?:\/\/|mailto:)/i;

function ToolbarDivider() {
  return <Separator orientation='vertical' className='mx-1 data-[orientation=vertical]:h-5' />;
}

function LinkControl({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');

  function apply() {
    const href = url.trim();
    if (!href) return;
    const normalized = SAFE_LINK_PATTERN.test(href) ? href : `https://${href}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run();
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setUrl((editor.getAttributes('link').href as string | undefined) ?? '');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant={active ? 'secondary' : 'ghost'}
          size='icon'
          aria-label='링크'
          className='size-9 shrink-0 md:size-8'
        >
          <Icons.link aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='flex w-72 flex-col gap-2'>
        <Input
          type='url'
          value={url}
          placeholder='https://'
          aria-label='링크 주소'
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              apply();
            }
          }}
        />
        <div className='flex justify-end gap-2'>
          {active ? (
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
                setOpen(false);
              }}
            >
              <Icons.linkOff aria-hidden />
              링크 제거
            </Button>
          ) : null}
          <Button type='button' size='sm' onClick={apply} disabled={!url.trim()}>
            적용
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EditorToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      underline: current.isActive('underline'),
      strike: current.isActive('strike'),
      bulletList: current.isActive('bulletList'),
      orderedList: current.isActive('orderedList'),
      link: current.isActive('link'),
      align: current.isActive({ textAlign: 'center' })
        ? 'center'
        : current.isActive({ textAlign: 'right' })
          ? 'right'
          : 'left',
      fontSize: (current.getAttributes('textStyle').fontSize as string | undefined) ?? DEFAULT_FONT_SIZE,
      canUndo: current.can().undo(),
      canRedo: current.can().redo()
    })
  });

  const toggleClass = 'size-9 shrink-0 md:size-8';

  return (
    <div
      role='toolbar'
      aria-label='본문 서식'
      className={cn(
        'sticky top-0 z-10 flex items-center gap-0.5 overflow-x-auto border-b bg-background px-2 py-1',
        // 휴대폰: 가로 스크롤 힌트 — 오른쪽 끝 페이드(끝 여백 pr-8 안에서만 흐려져 마지막 버튼은 가리지 않음)
        'max-md:pr-8 max-md:[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)]'
      )}
    >
      <Toggle size='sm' className={toggleClass} aria-label='굵게' pressed={state.bold} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
        <Icons.bold aria-hidden />
      </Toggle>
      <Toggle size='sm' className={toggleClass} aria-label='기울임' pressed={state.italic} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
        <Icons.italic aria-hidden />
      </Toggle>
      <Toggle size='sm' className={toggleClass} aria-label='밑줄' pressed={state.underline} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}>
        <Icons.underline aria-hidden />
      </Toggle>
      <Toggle size='sm' className={toggleClass} aria-label='취소선' pressed={state.strike} onPressedChange={() => editor.chain().focus().toggleStrike().run()}>
        <Icons.strikethrough aria-hidden />
      </Toggle>
      <ToolbarDivider />
      <Select
        value={FONT_SIZES.some((size) => size.value === state.fontSize) ? state.fontSize : DEFAULT_FONT_SIZE}
        onValueChange={(next) => {
          if (next === DEFAULT_FONT_SIZE) {
            editor.chain().focus().unsetFontSize().run();
          } else {
            editor.chain().focus().setFontSize(next).run();
          }
        }}
      >
        <SelectTrigger size='sm' aria-label='글자 크기' className='h-8 w-20 shrink-0'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map((size) => (
            <SelectItem key={size.value} value={size.value}>
              {size.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ToolbarDivider />
      <Toggle size='sm' className={toggleClass} aria-label='글머리 목록' pressed={state.bulletList} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}>
        <Icons.list aria-hidden />
      </Toggle>
      <Toggle size='sm' className={toggleClass} aria-label='번호 목록' pressed={state.orderedList} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}>
        <Icons.listNumbers aria-hidden />
      </Toggle>
      <ToolbarDivider />
      <ToggleGroup
        type='single'
        size='sm'
        value={state.align}
        aria-label='정렬'
        className='shrink-0'
        onValueChange={(next) => {
          if (next) editor.chain().focus().setTextAlign(next).run();
        }}
      >
        <ToggleGroupItem value='left' aria-label='왼쪽 정렬' className={toggleClass}>
          <Icons.alignLeft aria-hidden />
        </ToggleGroupItem>
        <ToggleGroupItem value='center' aria-label='가운데 정렬' className={toggleClass}>
          <Icons.alignCenter aria-hidden />
        </ToggleGroupItem>
        <ToggleGroupItem value='right' aria-label='오른쪽 정렬' className={toggleClass}>
          <Icons.alignRight aria-hidden />
        </ToggleGroupItem>
      </ToggleGroup>
      <ToolbarDivider />
      <Button
        type='button'
        variant='ghost'
        size='icon'
        aria-label='표 삽입'
        className={toggleClass}
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <Icons.table aria-hidden />
      </Button>
      <LinkControl editor={editor} active={state.link} />
      <ToolbarDivider />
      <Button
        type='button'
        variant='ghost'
        size='icon'
        aria-label='실행 취소'
        className={toggleClass}
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Icons.undo aria-hidden />
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        aria-label='다시 실행'
        className={toggleClass}
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Icons.redo aria-hidden />
      </Button>
    </div>
  );
}

/**
 * 본문 편집기 (Tiptap) — 이미지 삽입 없음. 서버가 저장 시 allowlist로 최종 정화한다.
 * 비제어: 초기값만 받고 변경은 onChange(html)로 알린다.
 */
export function WorkflowRichTextEditor({
  initialContent,
  onChange,
  className
}: {
  initialContent: string;
  onChange: (html: string) => void;
  className?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        code: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          protocols: ['http', 'https', 'mailto'],
          isAllowedUri: (url) => SAFE_LINK_PATTERN.test(url)
        }
      }),
      TextStyle,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right'] }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: '내용을 입력하세요' })
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        'aria-label': '본문',
        'aria-multiline': 'true',
        role: 'textbox',
        class: cn(WORKFLOW_RICH_CONTENT_CLASS, 'min-h-60 px-4 py-3 outline-none')
      }
    },
    onUpdate: ({ editor: current }) => onChange(current.getHTML())
  });

  return (
    <div
      data-testid='workflow-editor'
      className={cn(
        // overflow-clip: 모서리는 자르되 스크롤 컨테이너를 만들지 않아 서식 툴바 sticky가 동작한다
        'overflow-clip rounded-lg border focus-within:ring-2 focus-within:ring-ring/50',
        '[&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-muted-foreground [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
        '[&_.tableWrapper]:overflow-x-auto [&_.selectedCell]:bg-primary/10',
        className
      )}
    >
      {editor ? <EditorToolbar editor={editor} /> : <div className='h-11 border-b' />}
      <EditorContent editor={editor} />
    </div>
  );
}
