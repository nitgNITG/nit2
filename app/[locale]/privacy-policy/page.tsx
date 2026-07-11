import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function PrivacyPolicyPage({
    params: { locale },
}: {
    params: { locale: string };
}) {
    const isAr = locale === "ar";
    const dir = isAr ? "rtl" : "ltr";

    return (
        <>
            <Navbar />
            <main dir={dir} className="py-12 lg:py-20 p-container max-w-3xl mx-auto">
                <h1 className={`text-3xl font-bold mb-8 ${isAr ? "text-right" : "text-left"}`}>
                    {isAr ? "سياسة الخصوصية" : "Privacy Policy"}
                </h1>

                {isAr ? (
                    <div className="space-y-6 text-gray-700 leading-relaxed text-right">
                        <p className="text-sm text-gray-400">آخر تحديث: يوليو 2025</p>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">١. من نحن</h2>
                            <p>
                                الشركة الوطنية لهندسة البرمجيات وتكنولوجيا المعلومات (N.I.T Egypt) — شركة مسجّلة في مصر، مقرها 168 شارع الملك فيصل، الجيزة. نقدم خدمات تطوير البرمجيات، المنصات التعليمية، وتطبيقات التجارة الإلكترونية.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">٢. البيانات التي نجمعها</h2>
                            <ul className="list-disc list-inside space-y-1 mr-4">
                                <li>الاسم والبريد الإلكتروني ورقم الهاتف عند التواصل معنا أو طلب عرض سعر.</li>
                                <li>بيانات التصفح (عنوان IP، نوع المتصفح) بشكل مجهول عبر أدوات التحليل.</li>
                                <li>أي معلومات ترسلها طوعاً عبر نماذج الموقع.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">٣. كيف نستخدم بياناتك</h2>
                            <ul className="list-disc list-inside space-y-1 mr-4">
                                <li>الرد على استفساراتك وإرسال عروض الأسعار.</li>
                                <li>تحسين الموقع وتجربة المستخدم.</li>
                                <li>إرسال تحديثات عن خدماتنا (يمكنك إلغاء الاشتراك في أي وقت).</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">٤. مشاركة البيانات</h2>
                            <p>
                                لا نبيع بياناتك لأي طرف ثالث. قد نشارك البيانات مع مزودي الخدمات التقنية (مثل استضافة السحابة) لأغراض تشغيل الموقع فقط، وتحت اتفاقيات سرية صارمة.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">٥. ملفات تعريف الارتباط (Cookies)</h2>
                            <p>
                                نستخدم ملفات تعريف الارتباط الأساسية لضمان عمل الموقع. لا نستخدم ملفات تتبع إعلانية. يمكنك تعطيل ملفات الارتباط من إعدادات متصفحك.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">٦. حقوقك</h2>
                            <p>
                                يحق لك طلب الاطلاع على بياناتك، تصحيحها، أو حذفها في أي وقت. تواصل معنا على{" "}
                                <a href="mailto:info@nitg-eg.com" className="text-[#1E7D67] underline">
                                    info@nitg-eg.com
                                </a>
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">٧. التواصل</h2>
                            <p>
                                لأي استفسار بخصوص الخصوصية: <a href="mailto:info@nitg-eg.com" className="text-[#1E7D67] underline">info@nitg-eg.com</a> | هاتف: <a href="tel:+201091568240" className="text-[#1E7D67] underline">+20 109 156 8240</a>
                            </p>
                        </section>
                    </div>
                ) : (
                    <div className="space-y-6 text-gray-700 leading-relaxed text-left">
                        <p className="text-sm text-gray-400">Last updated: July 2025</p>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">1. Who We Are</h2>
                            <p>
                                National Software Engineering & IT (N.I.T Egypt) — a company registered in Egypt, headquartered at 168 King Faisal Street, Giza. We provide software development, e-learning platforms, and eCommerce application services.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">2. Data We Collect</h2>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                                <li>Name, email, and phone number when you contact us or request a quote.</li>
                                <li>Anonymous browsing data (IP, browser type) via analytics tools.</li>
                                <li>Any information you voluntarily submit through our forms.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">3. How We Use Your Data</h2>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                                <li>To respond to inquiries and send price proposals.</li>
                                <li>To improve the website and user experience.</li>
                                <li>To send updates about our services (you can unsubscribe at any time).</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">4. Data Sharing</h2>
                            <p>
                                We do not sell your data to any third party. We may share data with technical service providers (e.g., cloud hosting) solely for operating the website, under strict confidentiality agreements.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">5. Cookies</h2>
                            <p>
                                We use essential cookies to ensure the website functions correctly. We do not use advertising tracking cookies. You can disable cookies in your browser settings.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">6. Your Rights</h2>
                            <p>
                                You have the right to access, correct, or delete your data at any time. Contact us at{" "}
                                <a href="mailto:info@nitg-eg.com" className="text-[#1E7D67] underline">
                                    info@nitg-eg.com
                                </a>
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">7. Contact</h2>
                            <p>
                                For privacy inquiries: <a href="mailto:info@nitg-eg.com" className="text-[#1E7D67] underline">info@nitg-eg.com</a> | Phone: <a href="tel:+201091568240" className="text-[#1E7D67] underline">+20 109 156 8240</a>
                            </p>
                        </section>
                    </div>
                )}
            </main>
            <Footer />
        </>
    );
}
