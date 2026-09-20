import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const [githubOwner = "", repositoryName = ""] =
  process.env.GITHUB_REPOSITORY?.split("/") ?? [];
const isProjectPage =
  Boolean(process.env.GITHUB_ACTIONS) &&
  Boolean(repositoryName) &&
  !repositoryName.endsWith(".github.io");
const basePath = isProjectPage ? `/${repositoryName}` : "";
const siteOrigin = githubOwner
  ? `https://${githubOwner.toLowerCase()}.github.io`
  : "http://localhost:3000";
const siteUrl = `${siteOrigin}${basePath}`;
const description =
  "一个面向交易业务场景的多 Agent 前端交互演示工作台，支持运营诊断、商品分析、招商、营销活动与项目管理。";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "交易 Agent｜多智能体业务工作台",
  description,
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
  },
  openGraph: {
    title: "交易 Agent｜多智能体业务工作台",
    description,
    type: "website",
    url: siteUrl,
  },
  twitter: {
    card: "summary",
    title: "交易 Agent｜多智能体业务工作台",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
