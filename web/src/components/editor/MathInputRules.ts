import { Extension, InputRule } from "@tiptap/core";

const INLINE_DOLLAR_TRIGGER = /(^|\s)\$([^$]+)\$(\s|[.,!?;:])?$/;
const INLINE_PAREN_TRIGGER = /(^|\s)\\\(([^)]+)\\\)(\s|[.,!?;:])?$/;
const BLOCK_DOLLAR_TRIGGER = /^\$\$([\s\S]+?)\$\$\n$/;
const BLOCK_BRACKET_TRIGGER = /^(?:\\\[)([\s\S]+?)(?:\\\])\n?$/;

export const MathInputRules = Extension.create({
  name: "mathInputRules",

  addInputRules() {
    return [
      inlineDollarRule(),
      inlineParenRule(),
      blockDollarRule(),
      blockBracketRule(),
    ];
  },
});

function inlineDollarRule() {
  return new InputRule({
    find: INLINE_DOLLAR_TRIGGER,
    handler: ({ state, range, match }) => {
      return handleInlineMatch({
        state,
        range,
        leading: match[1] ?? "",
        latex: match[2] ?? "",
        trailing: match[3] ?? "",
      });
    },
  });
}

function inlineParenRule() {
  return new InputRule({
    find: INLINE_PAREN_TRIGGER,
    handler: ({ state, range, match }) => {
      return handleInlineMatch({
        state,
        range,
        leading: match[1] ?? "",
        latex: match[2] ?? "",
        trailing: match[3] ?? "",
      });
    },
  });
}

function blockDollarRule() {
  return new InputRule({
    find: BLOCK_DOLLAR_TRIGGER,
    handler: ({ state, range, match }) => {
      return handleBlockMatch({
        state,
        range,
        latex: match[1] ?? "",
      });
    },
  });
}

function blockBracketRule() {
  return new InputRule({
    find: BLOCK_BRACKET_TRIGGER,
    handler: ({ state, range, match }) => {
      return handleBlockMatch({
        state,
        range,
        latex: match[1] ?? "",
      });
    },
  });
}

type InlineMatchArgs = {
  state: Parameters<InputRule["handler"]>[0]["state"];
  range: Parameters<InputRule["handler"]>[0]["range"];
  leading: string;
  latex: string;
  trailing: string;
};

function handleInlineMatch({
  state,
  range,
  leading,
  latex,
  trailing,
}: InlineMatchArgs) {
  const trimmed = latex.trim();
  if (!trimmed) return false;

  const { schema, selection } = state;
  const mathInline = schema.nodes.math_inline;
  if (!mathInline) return false;

  const start = range.from + leading.length;
  const end = range.to - (trailing ? trailing.length : 0);

  const tr = state.tr;
  const node = mathInline.create({ latex: trimmed });
  tr.replaceRangeWith(start, end, node);

  const insertPos = start + node.nodeSize;
  if (trailing) {
    tr.insertText(trailing, insertPos);
  }

  const SelectionClass = (selection as any).constructor;
  if (SelectionClass?.near) {
    const offset = trailing ? trailing.length : 0;
    tr.setSelection(
      SelectionClass.near(tr.doc.resolve(insertPos + offset))
    );
  }

  return true;
}

type BlockMatchArgs = {
  state: Parameters<InputRule["handler"]>[0]["state"];
  range: Parameters<InputRule["handler"]>[0]["range"];
  latex: string;
};

function handleBlockMatch({ state, range, latex }: BlockMatchArgs) {
  const trimmed = latex.trim();
  if (!trimmed) return false;

  const { schema, selection } = state;
  const mathDisplay = schema.nodes.math_display;
  const paragraph = schema.nodes.paragraph;
  if (!mathDisplay || !paragraph) return false;

  const tr = state.tr;
  const node = mathDisplay.create({ latex: trimmed });
  tr.replaceRangeWith(range.from, range.to, node);

  const insertPos = range.from + node.nodeSize;
  tr.insert(insertPos, paragraph.create());

  const SelectionClass = (selection as any).constructor;
  if (SelectionClass?.near) {
    tr.setSelection(SelectionClass.near(tr.doc.resolve(insertPos + 1)));
  }

  return true;
}
