import Link from 'next/link';

/** Google OAuth 앱 인증 시 "애플리케이션 홈페이지"로 제출하는 공개 페이지 — 로그인 없이 접근 가능해야 합니다. */
export default function AboutPage() {
  return (
    <div className='min-h-screen px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-3xl'>
        {/* Header */}
        <div className='mb-12 text-center'>
          <h1 className='text-foreground text-3xl font-bold tracking-tight sm:text-4xl'>WakeOne</h1>
          <p className='text-muted-foreground mt-4 text-lg'>
            주식회사 웨이크(Wake Corp) 임직원을 위한 사내 업무 포털
          </p>
        </div>

        {/* Content Sections */}
        <div className='space-y-8'>
          {/* 서비스 소개 */}
          <section className='bg-card rounded-2xl border p-8 shadow-sm'>
            <h2 className='text-foreground mb-4 text-xl font-semibold'>서비스 소개</h2>
            <p className='text-muted-foreground text-lg leading-relaxed'>
              WakeOne은 주식회사 웨이크가 직접 운영하는 내부 업무 시스템입니다. 회사 Google 계정으로
              로그인한 임직원이 식대 잔액 확인, 계약 문서 관리, 공지사항, CS 문의, 할 일 관리 등
              일상 업무를 한 곳에서 처리할 수 있습니다.
            </p>
          </section>

          {/* 주요 기능 */}
          <section className='bg-card rounded-2xl border p-8 shadow-sm'>
            <h2 className='text-foreground mb-4 text-xl font-semibold'>주요 기능</h2>
            <ul className='text-muted-foreground list-disc space-y-2 pl-5 text-lg leading-relaxed'>
              <li>식대(법인카드) 잔액 조회 및 잔액 안내 알림</li>
              <li>계약 문서 관리 및 첨부 누락 안내</li>
              <li>공지사항, 앱 내 알림, CS 문의 접수·응대</li>
              <li>조직도 및 동료 생일 안내</li>
              <li>Google Tasks 연동 할 일 관리</li>
            </ul>
          </section>

          {/* Google 계정 이용 */}
          <section className='bg-card rounded-2xl border p-8 shadow-sm'>
            <h2 className='text-foreground mb-4 text-xl font-semibold'>Google 계정 데이터 이용</h2>
            <p className='text-muted-foreground text-lg leading-relaxed'>
              WakeOne은 Google 로그인으로 이메일 주소·이름·프로필 이미지를 받아 본인 확인에
              사용합니다. 이용자가 승인한 경우 Google Tasks 권한으로 본인의 할 일 목록을 WakeOne의
              &lsquo;할 일&rsquo; 화면에서 조회·추가·수정·완료·삭제할 수 있도록 합니다. Google
              사용자 데이터는 광고나 AI 모델 학습에 사용하지 않으며 제3자에게 판매하거나 제공하지
              않습니다. 자세한 내용은{' '}
              <Link
                href='/privacy-policy#google-user-data'
                className='text-primary hover:underline'
              >
                개인정보처리방침
              </Link>
              을 확인해 주세요.
            </p>
          </section>

          {/* English summary — Google OAuth 심사 담당자용 */}
          <section className='bg-card rounded-2xl border p-8 shadow-sm' lang='en'>
            <h2 className='text-foreground mb-4 text-xl font-semibold'>About WakeOne</h2>
            <p className='text-muted-foreground text-lg leading-relaxed'>
              WakeOne is the internal work portal operated by Wake Corp. for its employees. Users
              sign in with Google to verify their identity. With the user&apos;s permission, WakeOne
              uses the Google Tasks API so users can view, create, edit, complete and delete their
              own task lists from the Tasks page in WakeOne. Google user data is never sold, used
              for advertising, or used to train AI models. WakeOne&apos;s use and transfer of
              information received from Google APIs adheres to the Google API Services User Data
              Policy, including the Limited Use requirements.
            </p>
          </section>
        </div>

        {/* Footer */}
        <footer className='text-muted-foreground mt-12 space-y-3 text-center text-sm'>
          <nav className='flex flex-wrap items-center justify-center gap-x-4 gap-y-2'>
            <Link href='/auth/sign-in' className='hover:text-foreground hover:underline'>
              로그인
            </Link>
            <Link href='/privacy-policy' className='hover:text-foreground hover:underline'>
              개인정보처리방침 (Privacy Policy)
            </Link>
            <Link href='/terms-of-service' className='hover:text-foreground hover:underline'>
              이용약관 (Terms of Service)
            </Link>
          </nav>
          <p>
            © 주식회사 웨이크 (Wake Corp.) ·{' '}
            <a href='mailto:info@wakecorp.com' className='hover:text-foreground hover:underline'>
              info@wakecorp.com
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
