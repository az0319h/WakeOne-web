import { z } from 'zod';

export const supportFormSchema = z.object({
  title: z.string().trim().min(2, '제목은 2자 이상이어야 합니다.'),
  body: z.string().trim().min(10, '본문은 10자 이상이어야 합니다.')
});

export const supportCommentFormSchema = z.object({
  body: z.string().trim().min(1, '댓글 본문을 입력해 주세요.').max(5000, '댓글은 5000자 이하로 입력해 주세요.')
});

export type SupportFormValues = z.infer<typeof supportFormSchema>;
export type SupportCommentFormValues = z.infer<typeof supportCommentFormSchema>;

export const emptySupportFormValues: SupportFormValues = {
  title: '',
  body: ''
};

export const emptySupportCommentFormValues: SupportCommentFormValues = {
  body: ''
};
