import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req) {
  try {
    const { toEmail, userName, level, score, feedback } = await req.json();

    if (!toEmail) {
      return NextResponse.json({ error: "Không tìm thấy email học viên" }, { status: 400 });
    }

    // Cấu hình tài khoản gửi Email (Nên dùng biến môi trường ở file .env)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // VD: trungtam.tiengtrung@gmail.com
        pass: process.env.EMAIL_PASS, // Mật khẩu ứng dụng (App Password) của Gmail
      },
    });

    const mailOptions = {
      from: `"Hệ thống HSKK" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `[HSKK] Kết quả bài thi ${level} của bạn`,
      html: `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #e11d48; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Kết quả bài thi HSKK</h1>
          </div>
          <div style="padding: 32px; background-color: #ffffff;">
            <p style="font-size: 16px; color: #334155;">Chào <b>${userName}</b>,</p>
            <p style="font-size: 16px; color: #334155;">Bài thi <b>${level}</b> của bạn đã được giáo viên chấm xong. Dưới đây là kết quả:</p>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
              <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; font-weight: bold;">Điểm tổng kết</p>
              <p style="margin: 8px 0 0 0; font-size: 48px; font-weight: 900; color: ${score >= 60 ? '#10b981' : '#ef4444'};">
                ${score}<span style="font-size: 24px; color: #94a3b8;">/100</span>
              </p>
            </div>

            <h3 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Nhận xét từ giáo viên:</h3>
            <p style="font-size: 16px; color: #334155; line-height: 1.6; white-space: pre-wrap; background-color: #f1f5f9; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6;">${feedback}</p>
            
            <p style="font-size: 16px; color: #334155; margin-top: 32px;">Chúc bạn học tập tốt!<br/><b>Trung tâm Tiếng Trung</b></p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: "Đã gửi email thành công!" });
  } catch (error) {
    console.error("Lỗi gửi Email:", error);
    return NextResponse.json({ error: "Lỗi hệ thống gửi mail" }, { status: 500 });
  }
}