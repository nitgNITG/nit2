import ArticleEditor from '../../../components/ArticleEditor'

const EditArticle = ({ params }: { params: { articleId: string } }) => <ArticleEditor articleId={params.articleId} />

export default EditArticle
