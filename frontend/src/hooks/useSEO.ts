import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { seoApi } from '@/api/seoService';

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

export function useSEO(props?: SEOProps) {
  const { data: publicSEO } = useQuery({
    queryKey: ['publicSEO'],
    queryFn: seoApi.getPublicSEO,
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    // 1. Page Title
    const activeTitle =
      props?.title ||
      publicSEO?.meta_title ||
      'TrustMyLab — Multi-Tenant Diagnostic Laboratory Management System (LIMS)';
    document.title = activeTitle;

    // 2. Helper to set or create meta tag
    const setMetaTag = (attribute: string, value: string, content: string) => {
      let element = document.querySelector(`meta[${attribute}="${value}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, value);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 3. Meta Description
    const activeDesc =
      props?.description ||
      publicSEO?.meta_description ||
      'Cloud-based diagnostic laboratory management system (LIMS) for pathology and radiology centers. Automate CBC/LFT/KFT calculations, QR-verified PDF reports, doctor commissions, and billing.';
    setMetaTag('name', 'description', activeDesc);
    setMetaTag('name', 'title', activeTitle);

    // 4. Meta Keywords
    const activeKeywords = props?.keywords || publicSEO?.meta_keywords;
    if (activeKeywords) {
      setMetaTag('name', 'keywords', activeKeywords);
    }

    // 5. Open Graph Tags
    setMetaTag('property', 'og:title', props?.ogTitle || activeTitle);
    setMetaTag('property', 'og:description', props?.ogDescription || activeDesc);
    if (props?.ogImage || publicSEO?.og_image_url) {
      setMetaTag('property', 'og:image', props?.ogImage || publicSEO?.og_image_url || '');
    }

    // 6. Twitter Tags
    setMetaTag('name', 'twitter:title', props?.ogTitle || activeTitle);
    setMetaTag('name', 'twitter:description', props?.ogDescription || activeDesc);
    if (props?.ogImage || publicSEO?.og_image_url) {
      setMetaTag('name', 'twitter:image', props?.ogImage || publicSEO?.og_image_url || '');
    }

    // 7. Canonical URL
    const canonicalHref = props?.canonical || (publicSEO?.canonical_url ? `${publicSEO.canonical_url}${window.location.pathname}` : window.location.href);
    let canonicalTag = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.setAttribute('href', canonicalHref);

    // 8. Site Verification if configured
    if (publicSEO?.google_site_verification) {
      setMetaTag('name', 'google-site-verification', publicSEO.google_site_verification);
    }
    if (publicSEO?.bing_site_verification) {
      setMetaTag('name', 'msvalidate.01', publicSEO.bing_site_verification);
    }
  }, [props, publicSEO]);

  return { seo: publicSEO };
}
