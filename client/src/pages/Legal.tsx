import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, FileText, Shield, Users, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type DocumentType = 'terms' | 'privacy' | 'beta-expectations' | 'beta-confidentiality';

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <div id={id} className="mb-8">
      <h2 className="text-lg font-bold text-foreground mb-3">{title}</h2>
      <div className="space-y-3 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
      <div className="space-y-2 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{children}</p>;
}

function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-violet-600 hover:text-violet-700 dark:text-violet-400 hover:underline" target={href.startsWith('mailto') ? undefined : '_blank'} rel="noopener noreferrer">
      {children}
    </a>
  );
}

function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-sm leading-relaxed ml-2">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

const TermsContent = (
  <div className="space-y-2">
    <div className="mb-6">
      <p className="text-xs text-muted-foreground italic">Last updated April 09, 2026</p>
    </div>

    <div className="mb-8 space-y-3">
      <h2 className="text-lg font-bold text-foreground">AGREEMENT TO OUR LEGAL TERMS</h2>
      <P>
        We are Kitespace LLC (<strong>"Company," "we," "us," "our"</strong>), a company registered in Washington, United States at 522 W Riverside Ave, Ste N, Spokane, WA 99201.
      </P>
      <P>
        We operate the website <A href="https://kiteframe.space">https://kiteframe.space</A> (the <strong>"Site"</strong>), as well as any other related products and services that refer or link to these legal terms (the <strong>"Legal Terms"</strong>) (collectively, the <strong>"Services"</strong>).
      </P>
      <P>
        You can contact us by email at <A href="mailto:info@kiteframe.space">info@kiteframe.space</A> or by mail to 237 Broderick St, Apt 1, San Francisco, CA 94117, United States.
      </P>
      <P>
        These Legal Terms constitute a legally binding agreement made between you, whether personally or on behalf of an entity (<strong>"you"</strong>), and Kitespace LLC, concerning your access to and use of the Services. You agree that by accessing the Services, you have read, understood, and agreed to be bound by all of these Legal Terms. <strong>IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SERVICES AND YOU MUST DISCONTINUE USE IMMEDIATELY.</strong>
      </P>
      <P>
        Supplemental terms and conditions or documents that may be posted on the Services from time to time are hereby expressly incorporated herein by reference. We reserve the right, in our sole discretion, to make changes or modifications to these Legal Terms at any time and for any reason. We will alert you about any changes by updating the "Last updated" date of these Legal Terms, and you waive any right to receive specific notice of each such change. It is your responsibility to periodically review these Legal Terms to stay informed of updates. You will be subject to, and will be deemed to have been made aware of and to have accepted, the changes in any revised Legal Terms by your continued use of the Services after the date such revised Legal Terms are posted.
      </P>
      <P>
        The Services are intended for users who are at least 18 years old. Persons under the age of 18 are not permitted to use or register for the Services.
      </P>
      <P>We recommend that you print a copy of these Legal Terms for your records.</P>
    </div>

    <hr className="my-6 border-slate-200 dark:border-slate-700" />

    <div className="mb-8">
      <h2 className="text-lg font-bold text-foreground mb-3">TABLE OF CONTENTS</h2>
      <ol className="list-decimal list-inside space-y-1 text-sm text-violet-600 dark:text-violet-400 ml-2">
        {[
          'OUR SERVICES', 'INTELLECTUAL PROPERTY RIGHTS', 'USER REPRESENTATIONS',
          'USER REGISTRATION', 'PURCHASES AND PAYMENT', 'SUBSCRIPTIONS', 'CANCELLATION',
          'PROHIBITED ACTIVITIES', 'USER GENERATED CONTRIBUTIONS', 'CONTRIBUTION LICENSE',
          'THIRD-PARTY WEBSITES AND CONTENT', 'SERVICES MANAGEMENT', 'PRIVACY POLICY',
          'TERM AND TERMINATION', 'MODIFICATIONS AND INTERRUPTIONS', 'GOVERNING LAW',
          'DISPUTE RESOLUTION', 'CORRECTIONS', 'DISCLAIMER', 'LIMITATIONS OF LIABILITY',
          'INDEMNIFICATION', 'USER DATA', 'ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES',
          'CALIFORNIA USERS AND RESIDENTS', 'MISCELLANEOUS', 'CONTACT US',
        ].map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>

    <hr className="my-6 border-slate-200 dark:border-slate-700" />

    <Section id="services" title="1. OUR SERVICES">
      <P>
        The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation or which would subject us to any registration requirement within such jurisdiction or country. Accordingly, those persons who choose to access the Services from other locations do so on their own initiative and are solely responsible for compliance with local laws, if and to the extent local laws are applicable.
      </P>
      <P>
        The Services are not tailored to comply with industry-specific regulations (Health Insurance Portability and Accountability Act (HIPAA), Federal Information Security Management Act (FISMA), etc.), so if your interactions would be subjected to such laws, you may not use the Services. You may not use the Services in a way that would violate the Gramm-Leach-Bliley Act (GLBA).
      </P>
    </Section>

    <Section id="ip" title="2. INTELLECTUAL PROPERTY RIGHTS">
      <SubSection title="Our intellectual property">
        <P>
          We are the owner or the licensee of all intellectual property rights in our Services, including all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics in the Services (collectively, the "Content"), as well as the trademarks, service marks, and logos contained therein (the "Marks").
        </P>
        <P>
          Our Content and Marks are protected by copyright and trademark laws (and various other intellectual property rights and unfair competition laws) and treaties in the United States and around the world.
        </P>
        <P>
          The Content and Marks are provided in or through the Services "AS IS" for your personal, non-commercial use only.
        </P>
      </SubSection>
      <SubSection title="Your use of our Services">
        <P>
          Subject to your compliance with these Legal Terms, including the "PROHIBITED ACTIVITIES" section below, we grant you a non-exclusive, non-transferable, revocable license to:
        </P>
        <UL items={[
          'access the Services; and',
          'download or print a copy of any portion of the Content to which you have properly gained access,',
        ]} />
        <P>solely for your personal, non-commercial use.</P>
        <P>
          Except as set out in this section or elsewhere in our Legal Terms, no part of the Services and no Content or Marks may be copied, reproduced, aggregated, republished, uploaded, posted, publicly displayed, encoded, translated, transmitted, distributed, sold, licensed, or otherwise exploited for any commercial purpose whatsoever, without our express prior written permission.
        </P>
        <P>
          If you wish to make any use of the Services, Content, or Marks other than as set out in this section or elsewhere in our Legal Terms, please address your request to: <A href="mailto:info@kiteframe.space">info@kiteframe.space</A>. If we ever grant you the permission to post, reproduce, or publicly display any part of our Services or Content, you must identify us as the owners or licensors of the Services, Content, or Marks and ensure that any copyright or proprietary notice appears or is visible on posting, reproducing, or displaying our Content.
        </P>
        <P>We reserve all rights not expressly granted to you in and to the Services, Content, and Marks.</P>
        <P>Any breach of these Intellectual Property Rights will constitute a material breach of our Legal Terms and your right to use our Services will terminate immediately.</P>
      </SubSection>
      <SubSection title="Your submissions">
        <P>
          Please review this section and the "PROHIBITED ACTIVITIES" section carefully prior to using our Services to understand the (a) rights you give us and (b) obligations you have when you post or upload any content through the Services.
        </P>
        <P>
          <strong>Submissions:</strong> By directly sending us any question, comment, suggestion, idea, feedback, or other information about the Services ("Submissions"), you agree to assign to us all intellectual property rights in such Submission. You agree that we shall own this Submission and be entitled to its unrestricted use and dissemination for any lawful purpose, commercial or otherwise, without acknowledgment or compensation to you.
        </P>
        <P>
          <strong>You are responsible for what you post or upload:</strong> By sending us Submissions through any part of the Services you:
        </P>
        <UL items={[
          'confirm that you have read and agree with our "PROHIBITED ACTIVITIES" and will not post, send, publish, upload, or transmit through the Services any Submission that is illegal, harassing, hateful, harmful, defamatory, obscene, bullying, abusive, discriminatory, threatening to any person or group, sexually explicit, false, inaccurate, deceitful, or misleading;',
          'to the extent permissible by applicable law, waive any and all moral rights to any such Submission;',
          'warrant that any such Submission are original to you or that you have the necessary rights and licenses to submit such Submissions and that you have full authority to grant us the above-mentioned rights in relation to your Submissions; and',
          'warrant and represent that your Submissions do not constitute confidential information.',
        ]} />
        <P>You are solely responsible for your Submissions and you expressly agree to reimburse us for any and all losses that we may suffer because of your breach of (a) this section, (b) any third party's intellectual property rights, or (c) applicable law.</P>
      </SubSection>
    </Section>

    <Section id="userreps" title="3. USER REPRESENTATIONS">
      <P>By using the Services, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information and promptly update such registration information as necessary; (3) you have the legal capacity and you agree to comply with these Legal Terms; (4) you are not a minor in the jurisdiction in which you reside; (5) you will not access the Services through automated or non-human means, whether through a bot, script or otherwise; (6) you will not use the Services for any illegal or unauthorized purpose; and (7) your use of the Services will not violate any applicable law or regulation.</P>
      <P>If you provide any information that is untrue, inaccurate, not current, or incomplete, we have the right to suspend or terminate your account and refuse any and all current or future use of the Services (or any portion thereof).</P>
    </Section>

    <Section id="userreg" title="4. USER REGISTRATION">
      <P>You may be required to register with the Services. You agree to keep your password confidential and will be responsible for all use of your account and password. We reserve the right to remove, reclaim, or change a username you select if we determine, in our sole discretion, that such username is inappropriate, obscene, or otherwise objectionable.</P>
    </Section>

    <Section id="products" title="5. PURCHASES AND PAYMENT">
      <P>We accept the following forms of payment: Visa, Mastercard, American Express, and other major credit cards via Stripe.</P>
      <P>You agree to provide current, complete, and accurate purchase and account information for all purchases made via the Services. You further agree to promptly update account and payment information, including email address, payment method, and payment card expiration date, so that we can complete your transactions and contact you as needed. Sales tax will be added to the price of purchases as deemed required by us. We may change prices at any time. All payments shall be in US dollars.</P>
      <P>You agree to pay all charges at the prices then in effect for your purchases and any applicable fees, and you authorize us to charge your chosen payment provider for any such amounts upon placing your order. We reserve the right to correct any errors or mistakes in pricing, even if we have already requested or received payment.</P>
      <P>We reserve the right to refuse any order placed through the Services. We may, in our sole discretion, limit or cancel quantities purchased per person, per household, or per order. These restrictions may include orders placed by or under the same customer account, the same payment method, and/or orders that use the same billing or shipping address. We reserve the right to limit or prohibit orders that, in our sole judgment, appear to be placed by dealers, resellers, or distributors.</P>
    </Section>

    <Section id="subscriptions" title="6. SUBSCRIPTIONS">
      <SubSection title="Billing and Renewal">
        <P>Your subscription will continue and automatically renew unless canceled. You consent to our charging your payment method on a recurring basis without requiring your prior approval for each recurring charge, until such time as you cancel the applicable order. The length of your billing cycle will depend on the type of subscription plan you choose when you subscribed to the Services.</P>
      </SubSection>
      <SubSection title="Cancellation">
        <P>All purchases are non-refundable. You can cancel your subscription at any time by logging into your account. Your cancellation will take effect at the end of the current paid term. If you have any questions or are unsatisfied with our Services, please email us at <A href="mailto:info@kiteframe.space">info@kiteframe.space</A>.</P>
      </SubSection>
      <SubSection title="Fee Changes">
        <P>We may, from time to time, make changes to the subscription fee and will communicate any price changes to you in accordance with applicable law.</P>
      </SubSection>
    </Section>

    <Section id="cancel" title="7. CANCELLATION">
      <P>All purchases are non-refundable. You can cancel your subscription at any time by contacting us using the contact information provided below. Your cancellation will take effect at the end of the current paid term.</P>
      <P>If you are unsatisfied with our Services, please email us at <A href="mailto:info@kiteframe.space">info@kiteframe.space</A>.</P>
    </Section>

    <Section id="prohibited" title="8. PROHIBITED ACTIVITIES">
      <P>You may not access or use the Services for any purpose other than that for which we make the Services available. The Services may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.</P>
      <P>As a user of the Services, you agree not to:</P>
      <UL items={[
        'Systematically retrieve data or other content from the Services to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us.',
        'Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information such as user passwords.',
        'Circumvent, disable, or otherwise interfere with security-related features of the Services.',
        'Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services.',
        'Use any information obtained from the Services in order to harass, abuse, or harm another person.',
        'Make improper use of our support services or submit false reports of abuse or misconduct.',
        'Use the Services in a manner inconsistent with any applicable laws or regulations.',
        'Engage in unauthorized framing of or linking to the Services.',
        'Upload or transmit (or attempt to upload or to transmit) viruses, Trojan horses, or other material that interferes with any party\'s uninterrupted use and enjoyment of the Services.',
        'Engage in any automated use of the system, such as using scripts to send comments or messages.',
        'Delete the copyright or other proprietary rights notice from any Content.',
        'Attempt to impersonate another user or person or use the username of another user.',
        'Upload or transmit any material that acts as a passive or active information collection or transmission mechanism.',
        'Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services.',
        'Harass, annoy, intimidate, or threaten any of our employees or agents engaged in providing any portion of the Services to you.',
        'Attempt to bypass any measures of the Services designed to prevent or restrict access to the Services.',
        'Use the Services as part of any effort to compete with us or otherwise use the Services and/or the Content for any revenue-generating endeavor or commercial enterprise.',
      ]} />
    </Section>

    <Section id="ugc" title="9. USER GENERATED CONTRIBUTIONS">
      <P>The Services may invite you to chat, contribute to, or participate in blogs, message boards, online forums, and other functionality, and may provide you with the opportunity to create, submit, post, display, transmit, perform, publish, distribute, or broadcast content and materials to us or on the Services, including but not limited to text, writings, video, audio, photographs, graphics, comments, suggestions, or personal information or other material (collectively, "Contributions").</P>
      <P>Contributions may be viewable by other users of the Services and through third-party websites. As such, any Contributions you transmit may be treated in accordance with the Services' Privacy Policy. When you create or make available any Contributions, you thereby represent and warrant that your Contributions comply with our Legal Terms.</P>
    </Section>

    <Section id="license" title="10. CONTRIBUTION LICENSE">
      <P>By posting your Contributions to any part of the Services, you automatically grant, and you represent and warrant that you have the right to grant, to us an unrestricted, unlimited, irrevocable, perpetual, non-exclusive, transferable, royalty-free, fully-paid, worldwide right, and license to host, use, copy, reproduce, disclose, sell, resell, publish, broadcast, retitle, archive, store, cache, publicly perform, publicly display, reformat, translate, transmit, excerpt (in whole or in part), and distribute such Contributions for any purpose, commercial, advertising, or otherwise, and to prepare derivative works of, or incorporate into other works, such Contributions, and grant and authorize sublicenses of the foregoing.</P>
      <P>This license will apply to any form, media, or technology now known or hereafter developed, and includes our use of your name, company name, and franchise name, as applicable, and any of the trademarks, service marks, trade names, logos, and personal and commercial images you provide.</P>
      <P>We do not assert any ownership over your Contributions. You retain full ownership of all of your Contributions and any intellectual property rights or other proprietary rights associated with your Contributions. We are not liable for any statements or representations in your Contributions provided by you in any area on the Services.</P>
    </Section>

    <Section id="thirdparty" title="11. THIRD-PARTY WEBSITES AND CONTENT">
      <P>The Services may contain (or you may be sent via the Services) links to other websites ("Third-Party Websites") as well as articles, photographs, text, graphics, pictures, designs, music, sound, video, information, applications, software, and other content or items belonging to or originating from third parties ("Third-Party Content").</P>
      <P>Such Third-Party Websites and Third-Party Content are not investigated, monitored, or checked for accuracy, appropriateness, or completeness by us, and we are not responsible for any Third-Party Websites accessed through the Services or any Third-Party Content posted on, available through, or installed from the Services, including the content, accuracy, offensiveness, opinions, reliability, privacy practices, or other policies of or contained in the Third-Party Websites or the Third-Party Content.</P>
      <P>Inclusion of, linking to, or permitting the use or installation of any Third-Party Websites or any Third-Party Content does not imply approval or endorsement thereof by us. If you decide to leave the Services and access the Third-Party Websites or to use or install any Third-Party Content, you do so at your own risk and you should be aware these Legal Terms no longer govern.</P>
    </Section>

    <Section id="management" title="12. SERVICES MANAGEMENT">
      <P>We reserve the right, but not the obligation, to: (1) monitor the Services for violations of these Legal Terms; (2) take appropriate legal action against anyone who, in our sole discretion, violates the law or these Legal Terms, including without limitation, reporting such user to law enforcement authorities; (3) in our sole discretion and without limitation, refuse, restrict access to, limit the availability of, or disable (to the extent technologically feasible) any of your Contributions or any portion thereof; (4) in our sole discretion and without limitation, notice, or liability, to remove from the Services or otherwise disable all files and content that are excessive in size or are in any way burdensome to our systems; and (5) otherwise manage the Services in a manner designed to protect our rights and property and to facilitate the proper functioning of the Services.</P>
    </Section>

    <Section id="ppyes" title="13. PRIVACY POLICY">
      <P>We care about data privacy and security. Please review our Privacy Policy available on the Services. By using the Services, you agree to be bound by our Privacy Policy, which is incorporated into these Legal Terms. Please be advised the Services are hosted in the United States. If you access the Services from any other region of the world with laws or other requirements governing personal data collection, use, or disclosure that differ from applicable laws in the United States, then through your continued use of the Services, you are transferring your data to the United States, and you expressly consent to have your data transferred to and processed in the United States.</P>
    </Section>

    <Section id="terms" title="14. TERM AND TERMINATION">
      <P>These Legal Terms shall remain in full force and effect while you use the Services. WITHOUT LIMITING ANY OTHER PROVISION OF THESE LEGAL TERMS, WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SERVICES (INCLUDING BLOCKING CERTAIN IP ADDRESSES), TO ANY PERSON FOR ANY REASON OR FOR NO REASON, INCLUDING WITHOUT LIMITATION FOR BREACH OF ANY REPRESENTATION, WARRANTY, OR COVENANT CONTAINED IN THESE LEGAL TERMS OR OF ANY APPLICABLE LAW OR REGULATION.</P>
      <P>If we terminate or suspend your account for any reason, you are prohibited from registering and creating a new account under your name, a fake or borrowed name, or the name of any third party, even if you may be acting on behalf of the third party. In addition to terminating or suspending your account, we reserve the right to take appropriate legal action, including without limitation pursuing civil, criminal, and injunctive redress.</P>
    </Section>

    <Section id="modifications" title="15. MODIFICATIONS AND INTERRUPTIONS">
      <P>We reserve the right to change, modify, or remove the contents of the Services at any time or for any reason at our sole discretion without notice. However, we have no obligation to update any information on our Services. We will not be liable to you or any third party for any modification, price change, suspension, or discontinuance of the Services.</P>
      <P>We cannot guarantee the Services will be available at all times. We may experience hardware, software, or other problems or need to perform maintenance related to the Services, resulting in interruptions, delays, or errors. We reserve the right to change, revise, update, suspend, discontinue, or otherwise modify the Services at any time or for any reason without notice to you. You agree that we have no liability whatsoever for any loss, damage, or inconvenience caused by your inability to access or use the Services during any downtime or discontinuance of the Services.</P>
    </Section>

    <Section id="law" title="16. GOVERNING LAW">
      <P>These Legal Terms and your use of the Services are governed by and construed in accordance with the laws of the State of Washington applicable to agreements made and to be entirely performed within the State of Washington, without regard to its conflict of law principles.</P>
    </Section>

    <Section id="disputes" title="17. DISPUTE RESOLUTION">
      <SubSection title="Informal Negotiations">
        <P>To expedite resolution and control the cost of any dispute, controversy, or claim related to these Legal Terms (each a "Dispute" and collectively, the "Disputes") brought by either you or us (individually, a "Party" and collectively, the "Parties"), the Parties agree to first attempt to negotiate any Dispute (except those Disputes expressly provided below) informally for at least thirty (30) days before initiating arbitration. Such informal negotiations commence upon written notice from one Party to the other Party.</P>
      </SubSection>
      <SubSection title="Binding Arbitration">
        <P>If the Parties are unable to resolve a Dispute through informal negotiations, the Dispute (except those Disputes expressly excluded below) will be finally and exclusively resolved by binding arbitration. YOU UNDERSTAND THAT WITHOUT THIS PROVISION, YOU WOULD HAVE THE RIGHT TO SUE IN COURT AND HAVE A JURY TRIAL. The arbitration shall be commenced and conducted under the Commercial Arbitration Rules of the American Arbitration Association ("AAA") and, where appropriate, the AAA's Supplementary Procedures for Consumer Related Disputes ("AAA Consumer Rules"), both of which are available at the <A href="https://www.adr.org">AAA website</A>.</P>
      </SubSection>
      <SubSection title="Restrictions">
        <P>The Parties agree that any arbitration shall be limited to the Dispute between the Parties individually. To the full extent permitted by law, (a) no arbitration shall be joined with any other proceeding; (b) there is no right or authority for any Dispute to be arbitrated on a class-action basis or to utilize class action procedures; and (c) there is no right or authority for any Dispute to be brought in a purported representative capacity on behalf of the general public or any other persons.</P>
      </SubSection>
      <SubSection title="Exceptions to Informal Negotiations and Arbitration">
        <P>The Parties agree that the following Disputes are not subject to the above provisions concerning informal negotiations and binding arbitration: (a) any Disputes seeking to enforce or protect, or concerning the validity of, any of the intellectual property rights of a Party; (b) any Dispute related to, or arising from, allegations of theft, piracy, invasion of privacy, or unauthorized use; and (c) any claim for injunctive relief.</P>
      </SubSection>
    </Section>

    <Section id="corrections" title="18. CORRECTIONS">
      <P>There may be information on the Services that contains typographical errors, inaccuracies, or omissions, including descriptions, pricing, availability, and various other information. We reserve the right to correct any errors, inaccuracies, or omissions and to change or update the information on the Services at any time, without prior notice.</P>
    </Section>

    <Section id="disclaimer" title="19. DISCLAIMER">
      <P>THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF, INCLUDING, WITHOUT LIMITATION, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE MAKE NO WARRANTIES OR REPRESENTATIONS ABOUT THE ACCURACY OR COMPLETENESS OF THE SERVICES' CONTENT OR THE CONTENT OF ANY WEBSITES OR MOBILE APPLICATIONS LINKED TO THE SERVICES AND WE WILL ASSUME NO LIABILITY OR RESPONSIBILITY FOR ANY (1) ERRORS, MISTAKES, OR INACCURACIES OF CONTENT AND MATERIALS, (2) PERSONAL INJURY OR PROPERTY DAMAGE, OF ANY NATURE WHATSOEVER, RESULTING FROM YOUR ACCESS TO AND USE OF THE SERVICES, (3) ANY UNAUTHORIZED ACCESS TO OR USE OF OUR SECURE SERVERS AND/OR ANY AND ALL PERSONAL INFORMATION AND/OR FINANCIAL INFORMATION STORED THEREIN, (4) ANY INTERRUPTION OR CESSATION OF TRANSMISSION TO OR FROM THE SERVICES, (5) ANY BUGS, VIRUSES, TROJAN HORSES, OR THE LIKE WHICH MAY BE TRANSMITTED TO OR THROUGH THE SERVICES BY ANY THIRD PARTY, AND/OR (6) ANY ERRORS OR OMISSIONS IN ANY CONTENT AND MATERIALS OR FOR ANY LOSS OR DAMAGE OF ANY KIND INCURRED AS A RESULT OF THE USE OF ANY CONTENT POSTED, TRANSMITTED, OR OTHERWISE MADE AVAILABLE VIA THE SERVICES. WE DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR ANY PRODUCT OR SERVICE ADVERTISED OR OFFERED BY A THIRD PARTY THROUGH THE SERVICES, ANY HYPERLINKED WEBSITE, OR ANY WEBSITE OR MOBILE APPLICATION FEATURED IN ANY BANNER OR OTHER ADVERTISING, AND WE WILL NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR MONITORING ANY TRANSACTION BETWEEN YOU AND ANY THIRD-PARTY PROVIDERS OF PRODUCTS OR SERVICES.</P>
    </Section>

    <Section id="liability" title="20. LIMITATIONS OF LIABILITY">
      <P>IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. NOTWITHSTANDING ANYTHING TO THE CONTRARY CONTAINED HEREIN, OUR LIABILITY TO YOU FOR ANY CAUSE WHATSOEVER AND REGARDLESS OF THE FORM OF THE ACTION, WILL AT ALL TIMES BE LIMITED TO THE AMOUNT PAID, IF ANY, BY YOU TO US DURING THE SIX (6) MONTH PERIOD PRIOR TO ANY CAUSE OF ACTION ARISING. CERTAIN US STATE LAWS AND INTERNATIONAL LAWS DO NOT ALLOW LIMITATIONS ON IMPLIED WARRANTIES OR THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES. IF THESE LAWS APPLY TO YOU, SOME OR ALL OF THE ABOVE DISCLAIMERS OR LIMITATIONS MAY NOT APPLY TO YOU, AND YOU MAY HAVE ADDITIONAL RIGHTS.</P>
    </Section>

    <Section id="indemnification" title="21. INDEMNIFICATION">
      <P>You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all of our respective officers, agents, partners, and employees, from and against any loss, damage, liability, claim, or demand, including reasonable attorneys' fees and expenses, made by any third party due to or arising out of: (1) use of the Services; (2) breach of these Legal Terms; (3) any breach of your representations and warranties set forth in these Legal Terms; (4) your violation of the rights of a third party, including but not limited to intellectual property rights; or (5) any overt harmful act toward any other user of the Services with whom you connected via the Services. Notwithstanding the foregoing, we reserve the right, at your expense, to assume the exclusive defense and control of any matter for which you are required to indemnify us, and you agree to cooperate, at your expense, with our defense of such claims. We will use reasonable efforts to notify you of any such claim, action, or proceeding which is subject to this indemnification upon becoming aware of it.</P>
    </Section>

    <Section id="userdata" title="22. USER DATA">
      <P>We will maintain certain data that you transmit to the Services for the purpose of managing the performance of the Services, as well as data relating to your use of the Services. Although we perform regular routine backups of data, you are solely responsible for all data that you transmit or that relates to any activity you have undertaken using the Services. You agree that we shall have no liability to you for any loss or corruption of any such data, and you hereby waive any right of action against us arising from any such loss or corruption of such data.</P>
    </Section>

    <Section id="electronic" title="23. ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES">
      <P>Visiting the Services, sending us emails, and completing online forms constitute electronic communications. You consent to receive electronic communications, and you agree that all agreements, notices, disclosures, and other communications we provide to you electronically, via email and on the Services, satisfy any legal requirement that such communication be in writing. YOU HEREBY AGREE TO THE USE OF ELECTRONIC SIGNATURES, CONTRACTS, ORDERS, AND OTHER RECORDS, AND TO ELECTRONIC DELIVERY OF NOTICES, POLICIES, AND RECORDS OF TRANSACTIONS INITIATED OR COMPLETED BY US OR VIA THE SERVICES. You hereby waive any rights or requirements under any statutes, regulations, rules, ordinances, or other laws in any jurisdiction which require an original signature or delivery or retention of non-electronic records, or to payments or the granting of credits by any means other than electronic means.</P>
    </Section>

    <Section id="california" title="24. CALIFORNIA USERS AND RESIDENTS">
      <P>If any complaint with us is not satisfactorily resolved, you can contact the Complaint Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs in writing at 1625 North Market Blvd., Suite N 112, Sacramento, California 95834 or by telephone at (800) 952-5210 or (916) 445-1254.</P>
    </Section>

    <Section id="misc" title="25. MISCELLANEOUS">
      <P>These Legal Terms and any policies or operating rules posted by us on the Services or in respect to the Services constitute the entire agreement and understanding between you and us. Our failure to exercise or enforce any right or provision of these Legal Terms shall not operate as a waiver of such right or provision. These Legal Terms operate to the fullest extent permissible by law. We may assign any or all of our rights and obligations to others at any time. We shall not be responsible or liable for any loss, damage, delay, or failure to act caused by any cause beyond our reasonable control. If any provision or part of a provision of these Legal Terms is determined to be unlawful, void, or unenforceable, that provision or part of the provision is deemed severable from these Legal Terms and does not affect the validity and enforceability of any remaining provisions. There is no joint venture, partnership, employment or agency relationship created between you and us as a result of these Legal Terms or use of the Services. You agree that these Legal Terms will not be construed against us by virtue of having drafted them. You hereby waive any and all defenses you may have based on the electronic form of these Legal Terms and the lack of signing by the parties hereto to execute these Legal Terms.</P>
    </Section>

    <Section id="contact" title="26. CONTACT US">
      <P>In order to resolve a complaint regarding the Services or to receive further information regarding use of the Services, please contact us at:</P>
      <div className="mt-3 text-sm text-slate-600 dark:text-slate-400 space-y-0.5">
        <p><strong>Kitespace LLC</strong></p>
        <p>237 Broderick St, Apt 1</p>
        <p>San Francisco, CA 94117</p>
        <p>United States</p>
        <p><A href="mailto:info@kiteframe.space">info@kiteframe.space</A></p>
      </div>
    </Section>
  </div>
);

const documents: Record<DocumentType, { title: string; icon: typeof FileText; content: ReactNode }> = {
  'terms': {
    title: 'Terms and Conditions',
    icon: FileText,
    content: TermsContent,
  },
  'privacy': {
    title: 'Privacy Policy',
    icon: Shield,
    content: `KITEFRAME — PRIVACY POLICY (BETA)

Last edited: 12/22/25

Kiteframe is a product of Kitespace, LLC, a Wyoming limited liability company.

This Privacy Policy explains how Kiteframe handles user information.

---

1. INFORMATION COLLECTED

Account info, usage metrics, and user-provided content.

---

2. DATA USAGE

Used solely to operate and improve the Service.

---

3. AI PROCESSING

User data is not used to train AI models. AI usage follows OpenAI and third-party policies.

---

4. DATA ACCESS

Projects are not accessed unless explicitly shared or required for support with consent.

---

5. SECURITY

Reasonable safeguards are applied; no system is fully secure.

---

6. USER RESPONSIBILITY

Users must comply with their organization's data and IP rules.

---

7. DATA RETENTION

Data retained only as long as necessary to operate the Service.

Contact: info@kiteframe.space`,
  },
  'beta-expectations': {
    title: 'Beta Expectations',
    icon: Users,
    content: `KITEFRAME — BETA EXPECTATIONS

Last edited: 12/22/25

Kiteframe is a product of Kitespace, LLC, a Wyoming limited liability company.

---

WHAT THIS BETA IS

An early-access environment for validating workflows and canvas performance.

---

EXPECTATIONS

• Provide feedback
• Respect confidentiality
• Avoid public sharing

---

DATA & AI

• Do not upload sensitive data without authorization
• AI outputs require human judgment

---

CONFIDENTIALITY

Kiteframe is not public. Do not share screenshots or demos.`,
  },
  'beta-confidentiality': {
    title: 'Beta Confidentiality Agreement',
    icon: Lock,
    content: `KITEFRAME — BETA CONFIDENTIALITY AGREEMENT

Last edited: 12/22/25

Kiteframe is a product of Kitespace, LLC, a Wyoming limited liability company.

By participating in the Kiteframe beta, you agree:

---

1. CONFIDENTIAL INFORMATION

Includes non-public features, screenshots, recordings, and documentation.

---

2. RESTRICTIONS

No public sharing or credential sharing without written consent.

---

3. FEEDBACK

Feedback may be used by Kitespace, LLC without obligation.

---

4. TERM

Applies until public launch or access revocation.`,
  },
};

const navItems: { id: DocumentType; label: string }[] = [
  { id: 'terms', label: 'Terms and Conditions' },
  { id: 'privacy', label: 'Privacy Policy' },
];

export default function Legal() {
  const [activeDoc, setActiveDoc] = useState<DocumentType>(() => {
    const hash = window.location.hash.replace('#', '') as DocumentType;
    return hash && documents[hash] ? hash : 'terms';
  });

  useEffect(() => {
    const updateFromHash = () => {
      const hash = window.location.hash.replace('#', '') as DocumentType;
      if (hash && documents[hash] && hash !== activeDoc) {
        setActiveDoc(hash);
      }
    };

    window.addEventListener('hashchange', updateFromHash);
    window.addEventListener('popstate', updateFromHash);

    return () => {
      window.removeEventListener('hashchange', updateFromHash);
      window.removeEventListener('popstate', updateFromHash);
    };
  }, [activeDoc]);

  const handleNavClick = (docId: DocumentType) => {
    setActiveDoc(docId);
    window.history.pushState(null, '', `/legal#${docId}`);
  };

  const currentDoc = documents[activeDoc];
  const Icon = currentDoc.icon;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="link-back-home">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-xl font-bold text-foreground" data-testid="text-logo">Kiteframe</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        <nav className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 min-h-[calc(100vh-65px)] p-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 px-3">
            Legal Documents
          </h2>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const ItemIcon = documents[item.id].icon;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                      activeDoc === item.id
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    )}
                    data-testid={`nav-${item.id}`}
                  >
                    <ItemIcon className="h-4 w-4" />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="flex-1 p-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                <Icon className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-document-title">
                {currentDoc.title}
              </h1>
            </div>

            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="prose prose-slate dark:prose-invert max-w-none" data-testid="text-document-content">
                {typeof currentDoc.content === 'string'
                  ? currentDoc.content.split('\n\n').map((paragraph, idx) => {
                      if (paragraph.startsWith('---')) {
                        return <hr key={idx} className="my-6 border-slate-200 dark:border-slate-700" />;
                      }
                      if (paragraph.match(/^\d+\./)) {
                        const [heading, ...rest] = paragraph.split('\n');
                        return (
                          <div key={idx} className="mb-4">
                            <h3 className="text-lg font-semibold text-foreground mb-2">{heading}</h3>
                            {rest.length > 0 && <p className="text-slate-600 dark:text-slate-400">{rest.join('\n')}</p>}
                          </div>
                        );
                      }
                      if (paragraph.startsWith('•')) {
                        return (
                          <ul key={idx} className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1 mb-4">
                            {paragraph.split('\n').map((line, lineIdx) => (
                              <li key={lineIdx}>{line.replace('• ', '')}</li>
                            ))}
                          </ul>
                        );
                      }
                      if (paragraph.match(/^[A-Z]{2,}/)) {
                        return (
                          <h2 key={idx} className="text-xl font-bold text-foreground mt-6 mb-2">
                            {paragraph}
                          </h2>
                        );
                      }
                      if (paragraph.startsWith('Contact:') || paragraph.startsWith('Last edited:')) {
                        return (
                          <p key={idx} className="text-sm text-muted-foreground italic mb-2">
                            {paragraph}
                          </p>
                        );
                      }
                      return (
                        <p key={idx} className="text-slate-600 dark:text-slate-400 mb-4">
                          {paragraph}
                        </p>
                      );
                    })
                  : currentDoc.content
                }
              </div>
            </ScrollArea>
          </div>
        </main>
      </div>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="text-sm text-muted-foreground">
              © 2025 Kitespace LLC. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground">
              Kiteframe is a product of Kitespace LLC.
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => handleNavClick('terms')}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-footer-terms"
            >
              Terms
            </button>
            <button
              onClick={() => handleNavClick('privacy')}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-footer-privacy"
            >
              Privacy
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
