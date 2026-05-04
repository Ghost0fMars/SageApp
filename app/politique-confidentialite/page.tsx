export default function PolitiqueConfidentialitePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          Confidentialité
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Politique de confidentialité
        </h1>
        <p className="mt-4 leading-7 text-slate-700">
          Sage est une application en phase de test destinée à accompagner les enseignants dans la
          préparation, l'organisation et le suivi de leur classe. Cette page présente les principes
          de traitement des données utilisées par l'application.
        </p>

        <div className="mt-6 grid gap-5 leading-7 text-slate-700">
          <section>
            <h2 className="text-xl font-semibold text-slate-950">Données enregistrées</h2>
            <p className="mt-2">
              L'application peut enregistrer les informations saisies par l'utilisateur : élèves,
              notes de suivi, évaluations, séquences, séances préparées, planning et événements de
              classe. Ces données servent uniquement au fonctionnement pédagogique de Sage.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">Compte utilisateur</h2>
            <p className="mt-2">
              Lorsqu'un compte est créé, l'adresse email est utilisée pour l'authentification et la
              sauvegarde des données associées à cet utilisateur. Les inscriptions peuvent être
              soumises à validation pendant la période de test.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">Usage de l'IA</h2>
            <p className="mt-2">
              Les informations nécessaires à la génération d'objectifs, de séquences ou de séances
              peuvent être transmises au service d'IA afin de produire une réponse. Il est recommandé
              de ne pas saisir d'informations sensibles inutiles dans les prompts ou dans le chat.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">Contact</h2>
            <p className="mt-2">
              Pour toute question ou demande d'aide, vous pouvez contacter l'association à l'adresse
              suivante :
              <a
                href="mailto:alacle.association@gmail.com"
                className="ml-1 font-semibold text-teal-700 underline-offset-4 hover:underline"
              >
                alacle.association@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}